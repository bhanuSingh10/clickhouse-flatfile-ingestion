import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@clickhouse/client"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { host, port, database, username, jwtToken, useSSL, queryType, tableName, query, columns, limit = 100 } = body

    // Validate required fields
    if (!host || !port || !database) {
      return NextResponse.json({ error: "Missing required connection parameters" }, { status: 400 })
    }

    if (!columns || !Array.isArray(columns) || columns.length === 0) {
      return NextResponse.json({ error: "At least one column must be selected" }, { status: 400 })
    }

    // Create ClickHouse client
    const client = createClient({
      host: `${useSSL ? "https" : "http"}://${host}:${port}`,
      database,
      username,
      password: jwtToken || undefined,
    })

    // Determine the query to execute
    let previewQuery: string
    const columnList = columns.join(", ")

    if (queryType === "table") {
      previewQuery = `SELECT ${columnList} FROM ${tableName} LIMIT ${limit}`
    } else {
      previewQuery = `SELECT ${columnList} FROM (${query}) LIMIT ${limit}`
    }

    // Execute the query
    const result = await client.query({
      query: previewQuery,
      format: "JSONEachRow",
    })

    const data = await result.json()

    // Process the data for preview
    const rows = data.map((row: any) => {
      return columns.map((col: string) => row[col])
    })

    return NextResponse.json({ columns, rows })
  } catch (error) {
    console.error("Error previewing data:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unknown error occurred" },
      { status: 500 },
    )
  }
}
