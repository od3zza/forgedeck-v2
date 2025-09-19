# ForgeDeck Checker ♨

ForgeDeck is a web application designed for Magic: The Gathering players. It allows you to paste your card collection and quickly discover which competitive or semi-competitive decks you can build or are close to completing.

The project is designed to be fast and efficient, using a pre-compilation data strategy to provide instant search results, and is deployed as a serverless application on Vercel.

## How It Works

The project has a unique data architecture to ensure high performance:

1.  **Data Source**: Deck data is stored in relational format in SQLite databases (`/db/*.db`).
2.  **Data Enrichment**: A script (`build.js`) connects to the [Scryfall API](https://scryfall.com/docs/api) to enrich the database with additional information, such as the color identity of each deck.
3.  **Data Compilation**: The data is then pre-compiled from SQLite into highly optimized static JSON files. This process creates an **inverted index** for the cards, allowing for extremely fast lookups without the need for real-time database queries in the API.
4.  **API**: The serverless API (`/api/search.js`) simply uses the pre-compiled JSON files to find matching decks based on the user's card list.
5.  **Frontend**: A simple and intuitive vanilla JavaScript interface allows users to input their cards, select a format, and view the results.

## Project Structure

```
/
├── api/                # Serverless functions for Vercel
│   ├── data/           # Optimized JSON data (generated at build time)
│   └── search.js       # Main API endpoint for searching decks
├── assets/             # Static assets like images and icons
├── db/                 # Raw data storage
│   ├── scripts/        # Scripts for processing the database
│   │   ├── compilar_dados.js
│   │   └── descobrir_schema.js
│   └── *.db            # SQLite database files
├── lib/                # Frontend assets
│   ├── script.js       # Client-side JavaScript
│   └── style.css       # Stylesheet
├── build.js            # Script to enrich data from Scryfall API
├── index.html          # Main HTML file
└── package.json        # Project manifest and dependencies
```

## How to Run Locally

### Prerequisites

-   [Node.js](https://nodejs.org/) (v18 or higher)
-   [Vercel CLI](https://vercel.com/docs/cli) (for local development)

### 1. Installation

Clone the repository and install the dependencies:

```bash
git clone https://github.com/od3zza/forgedeck.git
cd forgedeck
npm install
```

### 2. Data Preparation

The application relies on pre-compiled data. To generate this data from the SQLite databases, run the following commands:

**First, enrich the database with data from Scryfall:**
This step can take a while, as it makes requests to an external API.

```bash
npm run build:data
```

**Then, compile the data into JSON files for the API:**
This script is not yet in `package.json`, you can run it directly.

```bash
node db/scripts/compilar_dados.js
```

### 3. Local Development

To run the application locally using the Vercel development server:

```bash
vercel dev
```

The application will be available at `http://localhost:3000`.

---
*Project developed by [od3zza](https://github.com/od3zza).*