import { type NextRequest, NextResponse } from "next/server"
import * as fs from "fs/promises"
import * as path from "path"
import * as os from "os"
import { parse } from "csv-parse/sync"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const delimiter = (formData.get("delimiter") as string) || ","
    const hasHeader = formData.get("hasHeader") === "true"

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Create a temporary file
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "csv-parse-"))
    const filePath = path.join(tempDir, file.name)

    // Write the uploaded file to the temporary location
    const buffer = Buffer.from(await file.arrayBuffer())
    await fs.writeFile(filePath, buffer)

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

    // Clean up the temporary file
    await fs.unlink(filePath)
    await fs.rmdir(tempDir)

    // If the file has headers, use them as column names
    let columns: string[] = []
    let rows: any[][] = []

    if (hasHeader) {
      // For files with headers, records is an array of objects
      if (records.length === 0) {
        return NextResponse.json({ error: "CSV file is empty" }, { status: 400 })
      }

      // Extract column names from the first record's keys
      columns = Object.keys(records[0])

      // Convert records to rows
      rows = records.map((record: any) => columns.map((col) => record[col]))
    } else {
      // For files without headers, records is an array of arrays
      if (records.length === 0) {
        return NextResponse.json({ error: "CSV file is empty" }, { status: 400 })
      }

      // Generate column names (Column1, Column2, etc.)
      const columnCount = records[0].length
      columns = Array.from({ length: columnCount }, (_, i) => `Column${i + 1}`)

      // Use records directly as rows
      rows = records
    }

    // Limit preview to 100 rows
    const previewRows = rows.slice(0, 100)

    return NextResponse.json({ columns, rows: previewRows })
  } catch (error) {
    console.error("Error parsing CSV:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unknown error occurred" },
      { status: 500 },
    )
  }
}
