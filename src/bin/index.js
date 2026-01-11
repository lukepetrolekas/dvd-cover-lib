#!/usr/bin/env node
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const humanparser_1 = require("humanparser");
const string_similarity_js_1 = require("string-similarity-js");
const puppeteer_1 = __importDefault(require("puppeteer"));
const chalk_1 = __importDefault(require("chalk"));
const program = new commander_1.Command();
program.command('split')
    .description('Split a string into substrings and display as an array')
    .argument('<string>', 'string to split')
    .option('-d, --disc <disc>', 'disc', ',')
    .action((str, options) => {
    console.log(str.split(options.disc));
    console.log(chalk_1.default.green('Splitted string: ' + options.disc));
    console.log(chalk_1.default.green('Fetching movie data: ' + str));
    fetchMovie(str, "ABC");
});
program.parse();
function cleanTitle(title) {
    return title.replace("(Original)", "").trim();
}
function cleanCopyright(copyright) {
    var pattern = /\d{4}/g;
    let result = copyright.match(pattern);
    return result != null ? parseInt(result[0]) : 9999;
}
function lastFirst(fullName) {
    const attrs = (0, humanparser_1.parseName)(fullName);
    return attrs.lastName + ", " + attrs.firstName;
}
//strip typical keywords in film studios and numbered companies
const normalize = (s) => s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9 ]+/g, "")
    .replace(/\b(inc|ltd|enterprises|pictures|films|film|studios|studio|entertainment|productions|production|company|co)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
// the numbers represent an arbitrary scoring mechanism to select 'lead' producer/distributor
const canonical = [
    { company: "Columbia", score: 7 },
    { company: "Paramount", score: 10 },
    { company: "Warner", score: 10 },
    { company: "Universal", score: 10 },
    { company: "Netflix", score: 20 },
    { company: "Disney", score: 100 },
    { company: "Miramax", score: 5 },
    { company: "20th Century Fox", score: 15 },
    { company: "MGM", score: 10 },
    { company: "United Artists", score: 7 },
    { company: "Sony", score: 10 }
];
function prodAndDist(textList) {
    // strip typical keywords
    textList = textList.map(normalize);
    //console.log(chalk.green(textList));
    let producer = "";
    let max = -1;
    textList.forEach((t) => {
        if (t.length > 0) {
            canonical.forEach((prodCo) => {
                let similarity = (0, string_similarity_js_1.stringSimilarity)(t, prodCo.company);
                // console.log(chalk.yellow(similarity.toString()));
                if (similarity > 0.8) {
                    let ts = prodCo.score;
                    if (ts > max) {
                        max = ts;
                        producer = prodCo.company;
                        //console.log(chalk.red("Selected: " + producer) );
                    }
                }
            });
        }
    });
    console.log(chalk_1.default.green(producer));
    return producer;
}
/*
async function siblingContent(targetText: string, page: any) {
  // Locate the element with the specific text first
  // Use a relative XPath to find the immediate following sibling of any tag type
  let nextSiblingLocator = await page.locator(`::-p-text(${targetText})/following-sibling::*`);
  console.log(nextSiblingLocator);

  // To get the text content of the element found:
  //const text = await nextSiblingLocator.waitHandle().evaluate((node: any) => node.innerText);
  //const text = await page.evaluate((el: any) => el.innerText, nextSiblingLocator.waitHandle());
 // console.log(text);
  return "text";
}
  */
function siblingContent(targetText, page) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(chalk_1.default.blue(targetText));
        const locator = page.locator(`xpath=//div[contains(@class, "label") and contains(text(), "${targetText}")]/following-sibling::*[1]`);
        const handle = yield locator.waitHandle();
        const content = yield handle.evaluate((el) => el.textContent);
        console.log(chalk_1.default.yellow(content));
        return [content.trim()];
    });
}
function directorContent(targetText, page) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(chalk_1.default.blue(targetText));
        const locator = page.locator(`xpath=//span[contains(text(), "Director")]/following-sibling::*[1]`);
        const handle = yield locator.waitHandle();
        const content = yield handle.evaluate((el) => el.textContent);
        console.log(chalk_1.default.yellow(content));
        return [content.trim()];
    });
}
function prodContent(targetText, page) {
    return __awaiter(this, void 0, void 0, function* () {
        let selector = 'xpath=//div[contains(@class, "label") and contains(text(), "Production company")]/following-sibling::*/a';
        const texts = yield page.$$eval(selector, (elements) => elements.map((el) => el.textContent.trim()));
        return texts;
    });
}
/*
async function siblingContent(targetText: string, page: any) {
// Locate the element with the specific text first
  const targetElement = page.getByText(targetText);

  // Use a relative XPath to find the immediate following sibling of any tag type
  let nextSiblingLocator = targetElement.locator('//following-sibling::*[1]').first();

  // Get the text content of the next sibling
  let nextSiblingText = await nextSiblingLocator.textContent();

  nextSiblingText = nextSiblingText.trim();

  return nextSiblingText;
}*/
/*
async function siblingContentList(targetText: string, page: any) {
// Locate the element with the specific text first
  const targetElement = page.getByText(targetText);

  // Use a relative XPath to find the immediate following sibling of any tag type
  let nextSiblingLocator = await targetElement.locator('//following-sibling::*[1]').allTextContents();

  return nextSiblingLocator;
}
*/
function fetchMovie(str, disc) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(chalk_1.default.green('Loading movie data...'));
        // Launch the browser and open a new blank page.
        const browser = yield puppeteer_1.default.launch();
        browser.on('disconnected', () => console.log("Browser disconnected"));
        const page = yield browser.newPage();
        const customUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36';
        yield page.setUserAgent(customUserAgent);
        yield page.goto(`https://collections-search.bfi.org.uk/web/Details/ChoiceFilmWorks/150530290`, { timeout: 0, waitUntil: 'domcontentloaded' });
        console.log(chalk_1.default.green("Movie page loaded..."));
        let bfiIndicator = (yield siblingContent("BFI identifier", page))[0];
        let movieTitleFinder = cleanTitle((yield siblingContent("Title", page))[0]);
        let copyright = cleanCopyright((yield siblingContent("Date", page))[0]);
        let dirname = lastFirst((yield directorContent("Director:", page))[0]);
        let prodDistList = yield prodContent("Production company:", page);
        let dist = prodAndDist(prodDistList);
        console.log(chalk_1.default.blue("Producer/Distributor:"));
        console.log(chalk_1.default.yellow(dist));
    });
}
