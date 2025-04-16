import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@clickhouse/client"
import { createWriteStream } from "fs"
import * as path from "path"
import * as fs from "fs/promises"
import * as os from "os"

// This is a streaming API endpoint that uses Server-Sent Events (SSE)
export async function GET(request: NextRequest) {
  const searchParams = new URL(request.url).searchParams
  const dataParam = searchParams.get("data")

  if (!dataParam) {
    return NextResponse.json({ error: "Missing data parameter" }, { status: 400 })
  }

  try {
    const body = JSON.parse(decodeURIComponent(dataParam))
    const { host, port, database, username, jwtToken, useSSL, queryType, tableName, query, columns } = body

    // Validate required fields
    if (!host || !port || !database) {
      return NextResponse.json({ error: "Missing required connection parameters" }, { status: 400 })
    }

    if (!columns || !Array.isArray(columns) || columns.length === 0) {
      return NextResponse.json({ error: "At least one column must be selected" }, { status: 400 })
    }

    // Create response stream for SSE
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Create ClickHouse client
          const client = createClient({
            host: `${useSSL ? "https" : "http"}://${host}:${port}`,
            database,
            username,
            password: jwtToken || undefined,
          })

          // Determine the query to execute
          let exportQuery: string
          const columnList = columns.join(", ")

          if (queryType === "table") {
            exportQuery = `SELECT ${columnList} FROM ${tableName}`
          } else {
            exportQuery = `SELECT ${columnList} FROM (${query})`
          }

          // Create a temporary file to store the CSV
          const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "clickhouse-export-"))
          const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
          const filename = `export_${timestamp}.csv`
          const outputPath = path.join(tempDir, filename)
          const outputStream = createWriteStream(outputPath)

          // Write CSV header
          outputStream.write(columns.join(",") + "\n")

          // Execute the query with streaming
          const result = await client.query({
            query: exportQuery,
            format: "CSVWithNames",
          })

          // Get the readable stream from the result
          const readableStream = result.stream()

          // Skip the first line (header) as we've already written it
          let isFirstLine = true
          let lineCount = 0
          let totalBytes = 0
          let estimatedTotalBytes = 1000000 // Initial estimate, will be updated

          // Process the stream line by line
          for await (const chunk of readableStream) {
            totalBytes += chunk.length

            // Update progress
            const progress = Math.min(99, Math.round((totalBytes / estimatedTotalBytes) * 100))
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ progress })}\n\n`))

            // Process the chunk
            const lines = chunk.toString().split("\n")
            for (const line of lines) {
              if (line.trim() === "") continue

              if (isFirstLine) {
                isFirstLine = false
                continue // Skip the header line
              }

              outputStream.write(line + "\n")
              lineCount++

              // Update progress every 1000 lines
              if (lineCount % 1000 === 0) {
                // Adjust the estimated total based on what we've seen so far
                estimatedTotalBytes = (totalBytes / lineCount) * (lineCount * 2)
                const progress = Math.min(99, Math.round((totalBytes / estimatedTotalBytes) * 100))
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ progress })}\n\n`))
              }
            }
          }

          // Close the output stream
          outputStream.end()

          // Send completion message
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                progress: 100,
                complete: true,
                recordCount: lineCount,
                filename,
              })}\n\n`,
            ),
          )

          // Close the stream
          controller.close()
        } catch (error) {
          console.error("Error exporting data:", error)
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                error: error instanceof Error ? error.message : "An unknown error occurred",
              })}\n\n`,
            ),
          )
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  } catch (error) {
    console.error("Error parsing request:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unknown error occurred" },
      { status: 500 },
    )
  }
}
