import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@clickhouse/client"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { host, port, database, username, jwtToken, useSSL, queryType, tableName, query } = body

    // Validate required fields
    if (!host || !port || !database) {
      return NextResponse.json({ error: "Missing required connection parameters" }, { status: 400 })
    }

    if (queryType === "table" && !tableName) {
      return NextResponse.json({ error: "Table name is required" }, { status: 400 })
    }

    if (queryType === "query" && !query) {
      return NextResponse.json({ error: "SQL query is required" }, { status: 400 })
    }

    // Create ClickHouse client
    const client = createClient({
      host: `${useSSL ? "https" : "http"}://${host}:${port}`,
      database,
      username,
      password: jwtToken || undefined,
    })

    // Determine the query to execute
    let schemaQuery: string

    if (queryType === "table") {
      schemaQuery = `DESCRIBE TABLE ${tableName}`
    } else {
      // For custom queries, we need to get the schema by running a LIMIT 0 query
      schemaQuery = `SELECT * FROM (${query}) LIMIT 0`
    }

    // Execute the query
    const result = await client.query({
      query: schemaQuery,
      format: "JSONEachRow",
    })

    const data = await result.json() as { meta?: { name: string; type: string }[] }

    // Process the schema data
    let columns: { name: string; type: string }[] = []

    if (queryType === "table") {
      // For DESCRIBE TABLE, the result has name and type columns
      if (Array.isArray(data)) {
        columns = data.map((row: any) => ({
          name: row.name,
          type: row.type,
        }))
      }
    } else {
      // For custom query with LIMIT 0, we need to extract column info from the result
      if (data?.meta && Array.isArray(data.meta)) {
        columns = data.meta.map((col: any) => ({
          name: col.name,
          type: col.type,
        }))
      }
    }

    return NextResponse.json({ columns })
  } catch (error) {
    console.error("Error fetching schema:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unknown error occurred" },
      { status: 500 },
    )
  }
}
