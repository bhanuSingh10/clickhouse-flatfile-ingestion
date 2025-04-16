import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@clickhouse/client"
import * as fs from "fs/promises"
import * as path from "path"
import * as os from "os"
import { parse } from "csv-parse/sync"

// This is a streaming API endpoint that uses Server-Sent Events (SSE)
export async function GET(request: NextRequest) {
  const searchParams = new URL(request.url).searchParams
  const filename = searchParams.get("filename")
  const tableName = searchParams.get("tableName")

  if (!filename || !tableName) {
    return NextResponse.json({ error: "Missing required parameters" }, { status: 400 })
  }

  // Create response stream for SSE
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      // This is just a placeholder for the SSE connection
      // The actual import happens in the POST handler
      // We'll send progress updates from there
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const delimiter = (formData.get("delimiter") as string) || ","
    const hasHeader = formData.get("hasHeader") === "true"
    const host = formData.get("host") as string
    const port = formData.get("port") as string
    const database = formData.get("database") as string
    const username = formData.get("username") as string
    const jwtToken = formData.get("jwtToken") as string
    const useSSL = formData.get("useSSL") === "true"
    const tableName = formData.get("tableName") as string
    const columnsJson = formData.get("columns") as string

    if (!file || !host || !port || !database || !tableName || !columnsJson) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 })
    }

    const columns = JSON.parse(columnsJson)

    if (!Array.isArray(columns) || columns.length === 0) {
      return NextResponse.json({ error: "At least one column must be selected" }, { status: 400 })
    }

    // Create a temporary file
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "csv-import-"))
    const filePath = path.join(tempDir, file.name)

    // Write the uploaded file to the temporary location
    const buffer = Buffer.from(await file.arrayBuffer())
    await fs.writeFile(filePath, buffer)

    // Create ClickHouse client
    const client = createClient({
      host: `${useSSL ? "https" : "http"}://${host}:${port}`,
      database,
      username,
      password: jwtToken || undefined,
    })

    // Create the table if it doesn't exist
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS ${tableName} (
        ${columns.map((col) => `${col.name} ${col.type}`).join(", ")}
      ) ENGINE = MergeTree() ORDER BY tuple()
    `

    await client
      .query({
        query: createTableQuery,
      })
      .exec()

    // Read and parse the CSV file
    const fileContent = await fs.readFile(filePath, "utf-8")

    // Parse the CSV content
    const parseOptions = {
      delimiter,
      columns: hasHeader,
      skip_empty_lines: true,
      trim: true,
    }

    const records = parse(fileContent, parseOptions)

    // Prepare data for insertion
    let rows: any[][] = []
    const columnNames = columns.map((col) => col.name)

    if (hasHeader) {
      // For files with headers, records is an array of objects
      rows = records.map((record: any) => columnNames.map((col) => record[col]))
    } else {
      // For files without headers, records is an array of arrays
      const columnIndices = columnNames.map((_, i) => i)
      rows = records.map((record: any) => columnIndices.map((i) => record[i]))
    }

    // Insert data in batches
    const batchSize = 1000
    const totalRows = rows.length
    let processedRows = 0

    for (let i = 0; i < totalRows; i += batchSize) {
      const batch = rows.slice(i, i + batchSize)

      // Prepare the insert query
      const insertQuery = `
        INSERT INTO ${tableName} (${columnNames.join(", ")})
        VALUES
      `

      // Format the values for insertion
      const values = batch
        .map((row) => {
          return `(${row
            .map((val: any) => {
              if (val === null || val === undefined || val === "") {
                return "NULL"
              }
              if (typeof val === "string") {
                return `'${val.replace(/'/g, "''")}'`
              }
              return val
            })
            .join(", ")})`
        })
        .join(", ")

      // Execute the insert query
      await client
        .query({
          query: insertQuery + values,
        })
        .exec()

      // Update progress
      processedRows += batch.length
      const progress = Math.round((processedRows / totalRows) * 100)

      // Send progress update via SSE
      // This would be handled by the client-side EventSource
    }

    // Clean up the temporary file
    await fs.unlink(filePath)
    await fs.rmdir(tempDir)

    return NextResponse.json({
      success: true,
      recordCount: totalRows,
      tableName,
    })
  } catch (error) {
    console.error("Error importing to ClickHouse:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unknown error occurred" },
      { status: 500 },
    )
  }
}
