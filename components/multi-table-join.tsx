"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2, AlertCircle, Plus, Trash2 } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Table {
  name: string
  alias: string
}

interface JoinCondition {
  type: "INNER JOIN" | "LEFT JOIN" | "RIGHT JOIN" | "FULL JOIN"
  table: string
  condition: string
}

interface MultiTableJoinProps {
  host: string
  port: string
  database: string
  username: string
  jwtToken: string
  useSSL: boolean
  onQueryGenerated: (query: string) => void
}

export function MultiTableJoin({
  host,
  port,
  database,
  username,
  jwtToken,
  useSSL,
  onQueryGenerated,
}: MultiTableJoinProps) {
  const [tables, setTables] = useState<Table[]>([{ name: "", alias: "" }])
  const [joins, setJoins] = useState<JoinCondition[]>([])
  const [availableTables, setAvailableTables] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [whereClause, setWhereClause] = useState("")
  const [orderByClause, setOrderByClause] = useState("")
  const [limitClause, setLimitClause] = useState("")

  // Fetch available tables from ClickHouse
  const fetchTables = async () => {
    try {
      setLoading(true)
      setError("")

      const connectionDetails = {
        host,
        port,
        database,
        username,
        jwtToken,
        useSSL,
      }

      const response = await fetch("/api/tables/clickhouse", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(connectionDetails),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to fetch tables")
      }

      const data = await response.json()
      setAvailableTables(data.tables)
      setLoading(false)
    } catch (error) {
      setError(error instanceof Error ? error.message : "An unknown error occurred")
      setLoading(false)
    }
  }

  // Add a new table
  const addTable = () => {
    setTables([...tables, { name: "", alias: "" }])
  }

  // Remove a table
  const removeTable = (index: number) => {
    const updatedTables = [...tables]
    updatedTables.splice(index, 1)
    setTables(updatedTables)

    // Remove any joins that reference this table
    const updatedJoins = joins.filter((join) => join.table !== tables[index].name)
    setJoins(updatedJoins)
  }

  // Update table name
  const updateTableName = (index: number, name: string) => {
    const updatedTables = [...tables]
    updatedTables[index].name = name
    setTables(updatedTables)
  }

  // Update table alias
  const updateTableAlias = (index: number, alias: string) => {
    const updatedTables = [...tables]
    updatedTables[index].alias = alias
    setTables(updatedTables)
  }

  // Add a new join condition
  const addJoin = () => {
    setJoins([...joins, { type: "INNER JOIN", table: "", condition: "" }])
  }

  // Remove a join condition
  const removeJoin = (index: number) => {
    const updatedJoins = [...joins]
    updatedJoins.splice(index, 1)
    setJoins(updatedJoins)
  }

  // Update join type
  const updateJoinType = (index: number, type: "INNER JOIN" | "LEFT JOIN" | "RIGHT JOIN" | "FULL JOIN") => {
    const updatedJoins = [...joins]
    updatedJoins[index].type = type
    setJoins(updatedJoins)
  }

  // Update join table
  const updateJoinTable = (index: number, table: string) => {
    const updatedJoins = [...joins]
    updatedJoins[index].table = table
    setJoins(updatedJoins)
  }

  // Update join condition
  const updateJoinCondition = (index: number, condition: string) => {
    const updatedJoins = [...joins]
    updatedJoins[index].condition = condition
    setJoins(updatedJoins)
  }

  // Generate SQL query
  const generateQuery = () => {
    try {
      // Validate inputs
      if (tables.length === 0 || !tables[0].name) {
        throw new Error("At least one table must be specified")
      }

      // Start building the query
      let query = "SELECT * FROM "

      // Add the first table
      const firstTable = tables[0]
      query += firstTable.name
      if (firstTable.alias) {
        query += ` AS ${firstTable.alias}`
      }

      // Add joins
      for (let i = 0; i < joins.length; i++) {
        const join = joins[i]
        if (!join.table || !join.condition) {
          throw new Error(`Join #${i + 1} is incomplete`)
        }

        query += ` ${join.type} ${join.table} ON ${join.condition}`
      }

      // Add WHERE clause if specified
      if (whereClause.trim()) {
        query += ` WHERE ${whereClause}`
      }

      // Add ORDER BY clause if specified
      if (orderByClause.trim()) {
        query += ` ORDER BY ${orderByClause}`
      }

      // Add LIMIT clause if specified
      if (limitClause.trim()) {
        query += ` LIMIT ${limitClause}`
      }

      // Pass the generated query to the parent component
      onQueryGenerated(query)
    } catch (error) {
      setError(error instanceof Error ? error.message : "An unknown error occurred")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Multi-Table Join</CardTitle>
        <CardDescription>Join multiple tables for export</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between">
          <Button variant="outline" onClick={fetchTables} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Fetch Available Tables"}
          </Button>
          <Button variant="outline" onClick={addTable}>
            <Plus className="mr-2 h-4 w-4" />
            Add Table
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <h3 className="text-lg font-medium">Tables</h3>
          {tables.map((table, index) => (
            <div key={index} className="grid grid-cols-12 gap-4 items-center">
              <div className="col-span-5">
                <Label htmlFor={`table-${index}`}>Table Name</Label>
                <Select value={table.name} onValueChange={(value) => updateTableName(index, value)}>
                  <SelectTrigger id={`table-${index}`}>
                    <SelectValue placeholder="Select table" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTables.map((tableName) => (
                      <SelectItem key={tableName} value={tableName}>
                        {tableName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-5">
                <Label htmlFor={`alias-${index}`}>Alias (optional)</Label>
                <Input
                  id={`alias-${index}`}
                  value={table.alias}
                  onChange={(e) => updateTableAlias(index, e.target.value)}
                  placeholder="t1"
                />
              </div>
              <div className="col-span-2 pt-7">
                {index > 0 && (
                  <Button variant="ghost" size="icon" onClick={() => removeTable(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Join Conditions</h3>
            <Button variant="outline" onClick={addJoin}>
              <Plus className="mr-2 h-4 w-4" />
              Add Join
            </Button>
          </div>
          {joins.map((join, index) => (
            <div key={index} className="space-y-4 border p-4 rounded-md">
              <div className="grid grid-cols-12 gap-4 items-center">
                <div className="col-span-5">
                  <Label htmlFor={`join-type-${index}`}>Join Type</Label>
                  <Select
                    value={join.type}
                    onValueChange={(value) =>
                      updateJoinType(index, value as "INNER JOIN" | "LEFT JOIN" | "RIGHT JOIN" | "FULL JOIN")
                    }
                  >
                    <SelectTrigger id={`join-type-${index}`}>
                      <SelectValue placeholder="Select join type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INNER JOIN">INNER JOIN</SelectItem>
                      <SelectItem value="LEFT JOIN">LEFT JOIN</SelectItem>
                      <SelectItem value="RIGHT JOIN">RIGHT JOIN</SelectItem>
                      <SelectItem value="FULL JOIN">FULL JOIN</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-5">
                  <Label htmlFor={`join-table-${index}`}>Table</Label>
                  <Select value={join.table} onValueChange={(value) => updateJoinTable(index, value)}>
                    <SelectTrigger id={`join-table-${index}`}>
                      <SelectValue placeholder="Select table" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTables.map((tableName) => (
                        <SelectItem key={tableName} value={tableName}>
                          {tableName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 pt-7">
                  <Button variant="ghost" size="icon" onClick={() => removeJoin(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div>
                <Label htmlFor={`join-condition-${index}`}>Join Condition</Label>
                <Input
                  id={`join-condition-${index}`}
                  value={join.condition}
                  onChange={(e) => updateJoinCondition(index, e.target.value)}
                  placeholder="t1.id = t2.id"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-medium">Additional Clauses (Optional)</h3>
          <div className="space-y-2">
            <Label htmlFor="where-clause">WHERE Clause</Label>
            <Input
              id="where-clause"
              value={whereClause}
              onChange={(e) => setWhereClause(e.target.value)}
              placeholder="column > 100"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="order-by-clause">ORDER BY Clause</Label>
            <Input
              id="order-by-clause"
              value={orderByClause}
              onChange={(e) => setOrderByClause(e.target.value)}
              placeholder="column DESC"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="limit-clause">LIMIT Clause</Label>
            <Input
              id="limit-clause"
              value={limitClause}
              onChange={(e) => setLimitClause(e.target.value)}
              placeholder="1000"
            />
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={generateQuery} className="w-full">
          Generate Query
        </Button>
      </CardFooter>
    </Card>
  )
}
