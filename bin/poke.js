#!/usr/bin/env node

const chalk = require("chalk");
const boxen = require("boxen");
const { init } = require('./index');

const greeting = chalk.white.bold("Hola Slowpoke!");

const boxenOptions = {
    padding: 1,
    margin: 1,
    borderStyle: "round",
    borderColor: "green",
    backgroundColor: "#555555"
};
const msgBox = boxen(greeting, boxenOptions);

console.log(msgBox);

const yargs = require("yargs");

const options = yargs
    .usage("Usage: -s <season_number>")
    .option("s", { alias: "season", describe: "season number", type: "string", demandOption: true })
    .argv;

console.log(`Scraping data for season ${options.season}...`);

(async () => {
    await init(options.season);
})()