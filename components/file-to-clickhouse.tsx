"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Loader2, AlertCircle, CheckCircle2, Upload, FileText } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface CSVColumn {
  name: string
  type: string
  selected: boolean
}

interface PreviewData {
  columns: string[]
  rows: any[][]
}

export function FileToClickHouse() {
  // File state
  const [file, setFile] = useState<File | null>(null)
  const [delimiter, setDelimiter] = useState(",")
  const [hasHeader, setHasHeader] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Connection state
  const [host, setHost] = useState("localhost")
  const [port, setPort] = useState("8123")
  const [database, setDatabase] = useState("default")
  const [username, setUsername] = useState("default")
  const [jwtToken, setJwtToken] = useState("")
  const [useSSL, setUseSSL] = useState(false)
  const [tableName, setTableName] = useState("")

  // UI state
  const [status, setStatus] = useState<"idle" | "parsing" | "previewing" | "importing" | "success" | "error">("idle")
  const [errorMessage, setErrorMessage] = useState("")
  const [columns, setColumns] = useState<CSVColumn[]>([])
  const [previewData, setPreviewData] = useState<PreviewData | null>(null)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<{ recordCount: number; tableName: string } | null>(null)

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0])
      setPreviewData(null)
      setColumns([])
      setErrorMessage("")
      setResult(null)
    }
  }

  // Handle parse CSV
  const handleParseCSV = async () => {
    if (!file) {
      setErrorMessage("Please select a file first")
      return
    }

    try {
      setStatus("parsing")
      setErrorMessage("")
      setColumns([])
      setPreviewData(null)

      const formData = new FormData()
      formData.append("file", file)
      formData.append("delimiter", delimiter)
      formData.append("hasHeader", hasHeader.toString())

      const response = await fetch("/api/parse/csv", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to parse CSV file")
      }

      const data = await response.json()

      // Infer column types and create column objects
      setColumns(
        data.columns.map((col: string, index: number) => ({
          name: col,
          type: inferColumnType(data.rows, index),
          selected: true,
        })),
      )

      setPreviewData(data)
      setStatus("idle")
    } catch (error) {
      setStatus("error")
      setErrorMessage(error instanceof Error ? error.message : "An unknown error occurred")
    }
  }

  // Infer column type based on values
  const inferColumnType = (rows: any[][], colIndex: number): string => {
    // Check first few non-empty values to determine type
    const sampleSize = Math.min(10, rows.length)
    const samples = []

    for (let i = 0; i < rows.length && samples.length < sampleSize; i++) {
      if (rows[i][colIndex] !== null && rows[i][colIndex] !== undefined && rows[i][colIndex] !== "") {
        samples.push(rows[i][colIndex])
      }
    }

    if (samples.length === 0) return "String"

    // Check if all samples are numbers
    const allNumbers = samples.every((sample) => !isNaN(Number(sample)))
    if (allNumbers) {
      // Check if all are integers
      const allIntegers = samples.every((sample) => Number.isInteger(Number(sample)))
      if (allIntegers) {
        // Determine integer size
        const maxVal = Math.max(...samples.map((s) => Number(s)))
        if (maxVal <= 255) return "UInt8"
        if (maxVal <= 65535) return "UInt16"
        return "UInt32"
      }
      return "Float64"
    }

    // Check if all samples are dates
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    const allDates = samples.every((sample) => dateRegex.test(String(sample)))
    if (allDates) return "Date"

    // Default to String
    return "String"
  }

  // Handle column type change
  const handleColumnTypeChange = (index: number, type: string) => {
    const updatedColumns = [...columns]
    updatedColumns[index].type = type
    setColumns(updatedColumns)
  }

  // Toggle column selection
  const toggleColumn = (index: number) => {
    const updatedColumns = [...columns]
    updatedColumns[index].selected = !updatedColumns[index].selected
    setColumns(updatedColumns)
  }

  // Select/deselect all columns
  const toggleAllColumns = (selected: boolean) => {
    setColumns(columns.map((col) => ({ ...col, selected })))
  }

  // Handle import to ClickHouse
  const handleImportToClickHouse = async () => {
    if (!file || !tableName) {
      setErrorMessage("Please select a file and provide a table name")
      return
    }

    try {
      setStatus("importing")
      setErrorMessage("")
      setProgress(0)
      setResult(null)

      const selectedColumns = columns.filter((col) => col.selected)

      if (selectedColumns.length === 0) {
        throw new Error("Please select at least one column to import")
      }

      const formData = new FormData()
      formData.append("file", file)
      formData.append("delimiter", delimiter)
      formData.append("hasHeader", hasHeader.toString())
      formData.append("host", host)
      formData.append("port", port)
      formData.append("database", database)
      formData.append("username", username)
      formData.append("jwtToken", jwtToken)
      formData.append("useSSL", useSSL.toString())
      formData.append("tableName", tableName)
      formData.append("columns", JSON.stringify(selectedColumns))

      // Set up progress tracking with EventSource
      const eventSourceUrl = `/api/import/file-to-clickhouse?${new URLSearchParams({
        filename: file.name,
        tableName,
      })}`

      const eventSource = new EventSource(eventSourceUrl)

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data)

        if (data.progress) {
          setProgress(data.progress)
        }

        if (data.complete) {
          setResult({
            recordCount: data.recordCount,
            tableName: data.tableName,
          })
          setStatus("success")
          eventSource.close()
        }
      }

      eventSource.onerror = () => {
        eventSource.close()
        setStatus("error")
        setErrorMessage("Error during import. Check server logs for details.")
      }

      // Start the import process
      const response = await fetch("/api/import/file-to-clickhouse", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to import data to ClickHouse")
      }
    } catch (error) {
      setStatus("error")
      setErrorMessage(error instanceof Error ? error.message : "An unknown error occurred")
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>CSV File Selection</CardTitle>
          <CardDescription>Select a CSV file to import</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="file">CSV File</Label>
            <Input id="file" type="file" accept=".csv" ref={fileInputRef} onChange={handleFileChange} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="delimiter">Delimiter</Label>
              <Input id="delimiter" value={delimiter} onChange={(e) => setDelimiter(e.target.value)} placeholder="," />
            </div>
            <div className="flex items-center space-x-2 pt-8">
              <Switch id="hasHeader" checked={hasHeader} onCheckedChange={setHasHeader} />
              <Label htmlFor="hasHeader">File has header row</Label>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button
            onClick={handleParseCSV}
            disabled={!file || status === "parsing" || status === "importing"}
            className="w-full"
          >
            {status === "parsing" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Parsing...
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                Parse CSV
              </>
            )}
          </Button>
        </CardFooter>
      </Card>

      {columns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>CSV Schema</CardTitle>
            <CardDescription>Configure columns for import</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between mb-4">
              <Button variant="outline" size="sm" onClick={() => toggleAllColumns(true)}>
                Select All
              </Button>
              <Button variant="outline" size="sm" onClick={() => toggleAllColumns(false)}>
                Deselect All
              </Button>
            </div>

            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Select</TableHead>
                    <TableHead>Column Name</TableHead>
                    <TableHead>Data Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {columns.map((column, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Switch
                          checked={column.selected}
                          onCheckedChange={() => toggleColumn(index)}
                          id={`column-${index}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Label htmlFor={`column-${index}`} className="cursor-pointer">
                          {column.name}
                        </Label>
                      </TableCell>
                      <TableCell>
                        <Select value={column.type} onValueChange={(value) => handleColumnTypeChange(index, value)}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="String">String</SelectItem>
                            <SelectItem value="UInt8">UInt8</SelectItem>
                            <SelectItem value="UInt16">UInt16</SelectItem>
                            <SelectItem value="UInt32">UInt32</SelectItem>
                            <SelectItem value="UInt64">UInt64</SelectItem>
                            <SelectItem value="Int8">Int8</SelectItem>
                            <SelectItem value="Int16">Int16</SelectItem>
                            <SelectItem value="Int32">Int32</SelectItem>
                            <SelectItem value="Int64">Int64</SelectItem>
                            <SelectItem value="Float32">Float32</SelectItem>
                            <SelectItem value="Float64">Float64</SelectItem>
                            <SelectItem value="Date">Date</SelectItem>
                            <SelectItem value="DateTime">DateTime</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {previewData && (
        <Card>
          <CardHeader>
            <CardTitle>Data Preview</CardTitle>
            <CardDescription>Showing first 100 rows</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md overflow-auto max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    {previewData.columns.map((column, index) => (
                      <TableHead key={index}>{column}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.rows.map((row, rowIndex) => (
                    <TableRow key={rowIndex}>
                      {row.map((cell, cellIndex) => (
                        <TableCell key={cellIndex}>{String(cell)}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>ClickHouse Connection</CardTitle>
          <CardDescription>Enter your ClickHouse connection details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="host">Host</Label>
              <Input id="host" value={host} onChange={(e) => setHost(e.target.value)} placeholder="localhost" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="port">Port</Label>
              <Input id="port" value={port} onChange={(e) => setPort(e.target.value)} placeholder="8123" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="database">Database</Label>
              <Input
                id="database"
                value={database}
                onChange={(e) => setDatabase(e.target.value)}
                placeholder="default"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="default"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="jwtToken">JWT Token (optional)</Label>
            <Input
              id="jwtToken"
              value={jwtToken}
              onChange={(e) => setJwtToken(e.target.value)}
              placeholder="JWT Token for authentication"
              type="password"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch id="useSSL" checked={useSSL} onCheckedChange={setUseSSL} />
            <Label htmlFor="useSSL">Use SSL/TLS</Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tableName">Target Table Name</Label>
            <Input
              id="tableName"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              placeholder="Enter target table name"
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button
            onClick={handleImportToClickHouse}
            disabled={!file || !tableName || columns.length === 0 || status === "parsing" || status === "importing"}
            className="w-full"
          >
            {status === "importing" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Import to ClickHouse
              </>
            )}
          </Button>
        </CardFooter>
      </Card>

      {errorMessage && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      {status === "importing" && (
        <Card>
          <CardHeader>
            <CardTitle>Import Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={progress} className="h-2" />
            <p className="text-center mt-2">{Math.round(progress)}%</p>
          </CardContent>
        </Card>
      )}

      {status === "success" && result && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Import Successful</AlertTitle>
          <AlertDescription>
            Imported {result.recordCount} records to table {result.tableName}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
