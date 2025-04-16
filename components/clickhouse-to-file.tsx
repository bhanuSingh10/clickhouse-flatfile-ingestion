"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Loader2, AlertCircle, CheckCircle2, Database, FileText } from "lucide-react"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { MultiTableJoin } from "@/components/multi-table-join"

interface ClickHouseColumn {
  name: string
  type: string
  selected: boolean
}

interface PreviewData {
  columns: string[]
  rows: any[][]
}

export function ClickHouseToFile() {
  // Connection state
  const [host, setHost] = useState("localhost")
  const [port, setPort] = useState("8123")
  const [database, setDatabase] = useState("default")
  const [username, setUsername] = useState("default")
  const [jwtToken, setJwtToken] = useState("")
  const [useSSL, setUseSSL] = useState(false)

  // Query state
  const [queryType, setQueryType] = useState("table")
  const [tableName, setTableName] = useState("test_table")
  const [customQuery, setCustomQuery] = useState("")
  const [joinQuery, setJoinQuery] = useState("")

  // UI state
  const [status, setStatus] = useState<"idle" | "connecting" | "fetching" | "exporting" | "success" | "error">("idle")
  const [errorMessage, setErrorMessage] = useState("")
  const [columns, setColumns] = useState<ClickHouseColumn[]>([])
  const [previewData, setPreviewData] = useState<PreviewData | null>(null)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<{ recordCount: number; filename: string } | null>(null)

  // Handle fetch schema
  const handleFetchSchema = async () => {
    try {
      setStatus("connecting")
      setErrorMessage("")
      setColumns([])
      setPreviewData(null)
      setResult(null)

      const connectionDetails = {
        host,
        port,
        database,
        username,
        jwtToken,
        useSSL,
        queryType,
        tableName: queryType === "table" ? tableName : "",
        query: queryType === "query" ? customQuery : "",
      }

      const response = await fetch("/api/schema/clickhouse", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(connectionDetails),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to fetch schema")
      }

      const data = await response.json()
      setColumns(data.columns.map((col: any) => ({ ...col, selected: true })))
      setStatus("idle")
    } catch (error) {
      setStatus("error")
      setErrorMessage(error instanceof Error ? error.message : "An unknown error occurred")
    }
  }

  // Handle preview data
  const handlePreviewData = async () => {
    try {
      setStatus("fetching")
      setErrorMessage("")
      setPreviewData(null)

      const selectedColumns = columns.filter((col) => col.selected).map((col) => col.name)

      if (selectedColumns.length === 0) {
        throw new Error("Please select at least one column to preview")
      }

      const connectionDetails = {
        host,
        port,
        database,
        username,
        jwtToken,
        useSSL,
        queryType,
        tableName: queryType === "table" ? tableName : "",
        query: queryType === "query" ? customQuery : "",
        columns: selectedColumns,
        limit: 100, // Preview only first 100 rows
      }

      const response = await fetch("/api/preview/clickhouse", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(connectionDetails),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to preview data")
      }

      const data = await response.json()
      setPreviewData(data)
      setStatus("idle")
    } catch (error) {
      setStatus("error")
      setErrorMessage(error instanceof Error ? error.message : "An unknown error occurred")
    }
  }

  // Handle export to CSV
  const handleExportToCSV = async () => {
    try {
      setStatus("exporting")
      setErrorMessage("")
      setProgress(0)
      setResult(null)

      const selectedColumns = columns.filter((col) => col.selected).map((col) => col.name)

      if (selectedColumns.length === 0) {
        throw new Error("Please select at least one column to export")
      }

      const connectionDetails = {
        host,
        port,
        database,
        username,
        jwtToken,
        useSSL,
        queryType,
        tableName: queryType === "table" ? tableName : "",
        query: queryType === "query" ? customQuery : "",
        columns: selectedColumns,
      }

      // Set up progress tracking with EventSource
      const eventSource = new EventSource(
        `/api/export/clickhouse-to-file?data=${encodeURIComponent(JSON.stringify(connectionDetails))}`,
      )

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data)

        if (data.progress) {
          setProgress(data.progress)
        }

        if (data.complete) {
          setResult({
            recordCount: data.recordCount,
            filename: data.filename,
          })
          setStatus("success")
          eventSource.close()
        }
      }

      eventSource.onerror = () => {
        eventSource.close()
        setStatus("error")
        setErrorMessage("Error during export. Check server logs for details.")
      }
    } catch (error) {
      setStatus("error")
      setErrorMessage(error instanceof Error ? error.message : "An unknown error occurred")
    }
  }

  const handleJoinQueryGenerated = (query: string) => {
    setQueryType("query")
    setCustomQuery(query)
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

  return (
    <div className="space-y-6">
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
        </CardContent>
      </Card>
      {queryType === "table" && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Multi-Table Join (Optional)</CardTitle>
            <CardDescription>Join multiple tables before export</CardDescription>
          </CardHeader>
          <CardContent>
            <MultiTableJoin
              host={host}
              port={port}
              database={database}
              username={username}
              jwtToken={jwtToken}
              useSSL={useSSL}
              onQueryGenerated={handleJoinQueryGenerated}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Query Configuration</CardTitle>
          <CardDescription>Specify table or custom query</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup value={queryType} onValueChange={setQueryType} className="space-y-4">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="table" id="table" />
              <Label htmlFor="table">Table</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="query" id="query" />
              <Label htmlFor="query">Custom SQL Query</Label>
            </div>
          </RadioGroup>

          {queryType === "table" ? (
            <div className="space-y-2">
              <Label htmlFor="tableName">Table Name</Label>
              <Input
                id="tableName"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                placeholder="Enter table name"
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="customQuery">SQL Query</Label>
              <Textarea
                id="customQuery"
                value={customQuery}
                onChange={(e) => setCustomQuery(e.target.value)}
                placeholder="SELECT * FROM table WHERE condition"
                className="min-h-[100px]"
              />
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button
            onClick={handleFetchSchema}
            disabled={status === "connecting" || status === "fetching" || status === "exporting"}
            className="w-full"
          >
            {status === "connecting" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Database className="mr-2 h-4 w-4" />
                Fetch Schema
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

      {columns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Schema</CardTitle>
            <CardDescription>Select columns to export</CardDescription>
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
                        <Checkbox
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
                      <TableCell>{column.type}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button
              variant="outline"
              onClick={handlePreviewData}
              disabled={status === "connecting" || status === "fetching" || status === "exporting"}
            >
              {status === "fetching" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Fetching...
                </>
              ) : (
                "Preview Data"
              )}
            </Button>
            <Button
              onClick={handleExportToCSV}
              disabled={status === "connecting" || status === "fetching" || status === "exporting"}
            >
              {status === "exporting" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  Export to CSV
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      )}

      {status === "exporting" && (
        <Card>
          <CardHeader>
            <CardTitle>Export Progress</CardTitle>
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
          <AlertTitle>Export Successful</AlertTitle>
          <AlertDescription>
            Exported {result.recordCount} records to {result.filename}
          </AlertDescription>
        </Alert>
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
    </div>
  )
}
