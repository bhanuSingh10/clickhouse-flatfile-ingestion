# 📊 ClickHouse ↔ Flat File Ingestion Tool

## 🚀 Overview

A full-stack web application to ingest data **from ClickHouse to Flat File** and **from Flat File to ClickHouse**, with optional **multi-table JOIN support**, **column selection**, **schema detection**, and **JWT authentication**.

---

## 🧰 Features

- 🔁 Bidirectional ingestion: ClickHouse → Flat File and Flat File → ClickHouse  
- 🔐 JWT-based authentication for ClickHouse  
- 📋 Schema detection and column selection UI  
- 🧠 Multi-table JOIN support with alias and conditions  
- 🛠️ Optional WHERE, ORDER BY, LIMIT clauses  
- 📊 Shows total records processed and status updates  
- 🖥️ Simple and intuitive UI (Next.js + TailwindCSS)

---

## 🏗️ Project Structure

```
my-nextjs-ingestion-tool/
├── app/
├── components/
├── hooks/
├── lib/
├── public/
├── styles/
├── .env.local
├── next.config.mjs
├── tailwind.config.ts
├── tsconfig.json
├── package.json
├── prompt.json
└── README.md
```

---

## ⚙️ Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/bhanuSingh10/clickhouse-flatfile-ingestion.git
cd clickhouse-flatfile-ingestion
```

### 2. Install Dependencies

```bash
pnpm install
# or
npm install 
```

---

## 🧪 Run Locally

### Start ClickHouse (via Docker)

```bash
docker run -d --name clickhouse-server -p 8123:8123 -p 9000:9000 clickhouse/clickhouse-server
```

### Run Development Server

```bash
npm run dev
```

Then open `http://localhost:3000` in your browser.




## 🧪 Sample Test Case (JOIN Example)

### Create Tables in ClickHouse

```sql
CREATE TABLE test1 (
    id UInt32,
    name String,
    salary UInt32
) ENGINE = MergeTree() ORDER BY id;

INSERT INTO test1 VALUES (1, 'Alice', 60000), (2, 'Bob', 45000), (3, 'Carol', 70000);

CREATE TABLE test2 (
    id UInt32,
    department String
) ENGINE = MergeTree() ORDER BY id;

INSERT INTO test2 VALUES (1, 'HR'), (2, 'Tech'), (3, 'Finance');
```

### Sample JOIN Query

```sql
SELECT *
FROM test1 AS t1
INNER JOIN test2 AS t2 ON t1.id = t2.id
WHERE t1.salary > 50000
ORDER BY t1.salary DESC
LIMIT 1000;
```

---

## ✅ Test Cases

1. Export ClickHouse table → CSV with selected columns  
2. Import CSV → ClickHouse table (auto-schema mapping)  
3. Multi-table JOIN in ClickHouse → export result to Flat File  
4. Invalid JOIN / query → handle error gracefully  
5. Preview schema before ingest/export  

---

## 🤖 AI Tooling

See `prompts.txt` for AI prompts used during development.

---

## 📂 Sample Datasets

- [uk_price_paid](https://clickhouse.com/docs/en/getting-started/example-datasets/uk-price-paid)  
- [ontime](https://clickhouse.com/docs/en/getting-started/example-datasets/ontime)  

---
 
## 👨‍💻 Tech Stack

| Layer        | Tech                |
|--------------|---------------------|
| Frontend     | Next.js + TailwindCSS |
| Backend      | API routes (Next.js) |
| Database     | ClickHouse          |
| Auth         | JWT                 |
| File Format  | CSV (Flat File)     |

---

## 🧾 License

MIT License
 

## 💡 Credits

Built for the **Zeotap Integration Assignment** — 2025