"use client"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ClickHouseToFile } from "@/components/clickhouse-to-file"
import { FileToClickHouse } from "@/components/file-to-clickhouse"

export default function Home() {
  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6 text-center">ClickHouse ↔ Flat File Data Ingestion Tool</h1>

      <Tabs defaultValue="clickhouse-to-file" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="clickhouse-to-file">ClickHouse → Flat File</TabsTrigger>
          <TabsTrigger value="file-to-clickhouse">Flat File → ClickHouse</TabsTrigger>
        </TabsList>

        <TabsContent value="clickhouse-to-file">
          <ClickHouseToFile />
        </TabsContent>

        <TabsContent value="file-to-clickhouse">
          <FileToClickHouse />
        </TabsContent>
      </Tabs>
    </div>
  )
}
