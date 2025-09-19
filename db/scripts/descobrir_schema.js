// /db/scripts/descobrir_schema.js

import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../');
const dbFilePath = path.join(projectRoot, 'db', 'pauper.db');

console.log('🔎  Iniciando a inspeção do banco de dados...');

const db = new sqlite3.Database(dbFilePath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        return console.error('❌ Erro ao abrir o banco de dados:', err.message);
    }
    console.log('✔️  Conectado ao banco de dados.');
});

// Esta query especial pede ao SQLite para listar todas as tabelas e como elas foram criadas.
const sqlQuery = `SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';`;

db.all(sqlQuery, [], (err, tables) => {
    if (err) {
        return console.error('❌ Erro ao buscar o schema:', err.message);
    }

    if (tables.length === 0) {
        console.log('⚠️ Nenhuma tabela encontrada no banco de dados.');
    } else {
        console.log('\n--- ESTRUTURA DO BANCO DE DADOS ENCONTRADA ---');
        tables.forEach(table => {
            console.log(`\n▶️ Tabela: ${table.name}`);
            console.log(`   SQL de Criação: ${table.sql}`);
        });
        console.log('\n----------------------------------------------');
        console.log('\nCopie e cole toda a estrutura acima para análise.');
    }

    db.close();
});