import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@clickhouse/client"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { host, port, database, username, jwtToken, useSSL } = body

    // Validate required fields
    if (!host || !port || !database) {
      return NextResponse.json({ error: "Missing required connection parameters" }, { status: 400 })
    }

    // Create ClickHouse client
    const client = createClient({
      host: `${useSSL ? "https" : "http"}://${host}:${port}`,
      database,
      username,
      password: jwtToken || undefined,
    })

    // Query to get all tables in the database
    const query = `
      SELECT name
      FROM system.tables
      WHERE database = '${database}'
      ORDER BY name
    `

    // Execute the query
    const result = await client.query({
      query,
      format: "JSONEachRow",
    })

    const data = await result.json()
    const tables = data.map((row: any) => row.name)

    return NextResponse.json({ tables })
  } catch (error) {
    console.error("Error fetching tables:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unknown error occurred" },
      { status: 500 },
    )
  }
}
