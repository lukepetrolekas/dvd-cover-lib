#!/usr/bin/env node
import { parseName } from 'humanparser';
import { stringSimilarity } from "string-similarity-js";
import puppeteer from 'puppeteer';
import chalk from 'chalk';
import process from 'process';
const { spawn } = require('child_process');
import tmp from 'tmp';
const fs = require('fs');
import { titleCase } from "title-case";

const args = process.argv.slice(2);
console.log(`The first user argument is: ${args[0]} the next is ${args[1]}`);
fetchMovie(args[0], args[1]);

function cleanTitle(title: string) {
  return titleCase(title.replace("(Original)", "").trim().toLowerCase());
}

function cleanCopyright(copyright: string) {
  var pattern = /\d{4}/g;
  let result = copyright.match(pattern);
  return result != null ? parseInt(result[0]) : 9999;
}

function lastFirst(fullName: string) {
  const attrs = parseName(fullName);

  if (attrs.lastName === undefined)
    attrs.lastName = ""
  if (attrs.firstName === undefined)
    attrs.firstName = ""
  if (attrs.middleName === undefined)
    attrs.middleName = ""

  return (attrs.lastName + ", " + attrs.firstName + " " + attrs.middleName).trim();
}

//strip typical keywords in film studios and numbered companies
const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9 ]+/g, "")
      .replace(/\b(inc|ltd|enterprises|pictures|films|film|studios|studio|entertainment|productions|production|company|co)\b/g, "")
      .replace(/\s+/g, " ")
      .trim();

interface ProdCo {
  company: string;
}

// the numbers represent an arbitrary scoring mechanism to select 'lead' producer/distributor
const canonical: ProdCo[] = [
  { company: "Columbia" },
  { company: "Paramount" },
  { company: "Warner" },
  { company: "Universal" },
  { company: "Netflix" },
  { company: "Disney" },
  { company: "Miramax" },
  { company: "Twentieth Century Fox" },
  { company: "Metro-Goldwyn-Mayer" },
  { company: "United Artists" },
  { company: "Sony"},
  { company: "Tristar"},
  { company: "New Line Cinema" },
  { company: "Telefilm Canada" },
  { company: "Castle Rock" }
];

function prodAndDist(textList: string[]) {
  // strip typical keywords
  textList = textList.map(normalize);

  let producer: string = "";
  let max: number = -1;

  textList.forEach((t: string) => {
    if (t.length > 0) {
      canonical.forEach((prodCo: ProdCo) => {
        let similarity: number = stringSimilarity(t, prodCo.company);
        //console.log(chalk.green(t) +  " " + chalk.red(prodCo.company) +  " " + chalk.yellow(similarity.toString()));
        
        if (similarity > max) {
            max = similarity;
            producer = prodCo.company;
            //console.log(c150707823halk.red("Selected: " + producer) );
        }
      })
    }
  });

  return producer;
}

async function siblingContent(targetText: string, page: any) {
  console.log(chalk.blue(targetText));
  const locator = page.locator( `xpath=//div[contains(@class, "label") and contains(text(), "${targetText}")]/following-sibling::*[1]` ); 
  const handle = await locator.waitHandle(); 
  const content = await handle.evaluate((el: any) => el.textContent);
  console.log(chalk.yellow(content));
  return [content.trim()];
}

async function directorContent(targetText: string, page: any) {
  console.log(chalk.blue(targetText));
  
  let locator = page.locator( `xpath=//span[contains(text(), "Director")]/following-sibling::*[1]`).setTimeout(3000); 
  let handle = await locator.waitHandle().catch(() => null);

  if (handle == null) {
     console.log(chalk.magentaBright("Trying 'Directed by' instead of 'Director'"));
    // seriously BFI?
    locator = await page.locator( `xpath=//span[contains(text(), "Directed by")]/following-sibling::*[1]` ).setTimeout(3000);
    handle = await locator.waitHandle().catch(() => null);
  }

  if (handle == null) {
    console.log(chalk.magentaBright("Okay, French then?"));
    // seriously BFI?
    locator = await page.locator( `xpath=//span[contains(text(), "Un film de")]/following-sibling::*[1]` ).setTimeout(3000);
    handle = await locator.waitHandle().catch(() => null);
  }
  
    // gripe because I can. shakes fist ;)
    if (handle != null) {
      console.log(chalk.green("Yay I found a director."));
      const content = await handle.evaluate((el: any) => el.textContent);
      console.log(chalk.yellow(content));
      return [content.trim()];
    }
    else {
      console.log(chalk.red("Failed director... sorry."));
      process.exit(1);
      return [""];
    }
}

async function prodContent(targetText: string, page: any) {
  let selector = 'xpath=//div[contains(@class, "label") and contains(text(), "Production company")]/following-sibling::*/a';

  const texts = await page.$$eval(selector, (elements: any) => 
    elements.map((el: any) => el.textContent.trim())
  );

  return texts;
}

async function fetchMovie(movieUrlId: string, discLetter: string) {
  console.log(chalk.green('Loading movie data...'));

  // Launch the browser and open a new blank page.
  const browser = await puppeteer.launch();
  browser.on('disconnected', () => console.log("Browser disconnected"));

  const page = await browser.newPage();

  const customUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36';
  await page.setUserAgent(customUserAgent);

  await page.goto(`https://collections-search.bfi.org.uk/web/Details/ChoiceFilmWorks/${movieUrlId}`, { timeout: 0, waitUntil: 'domcontentloaded' });
  
  console.log(chalk.green("Movie page loaded..."));
  let bfiIndicator = (await siblingContent("BFI identifier", page))[0];

  let movieTitleFinder = cleanTitle((await siblingContent("Title", page))[0]);
  let copyright = cleanCopyright((await siblingContent("Date", page))[0]);
  let dirname = lastFirst((await directorContent("Director:", page))[0]);

  let prodDistList: string[] = await prodContent("Production company:", page);
  let dist = prodAndDist(prodDistList);

  console.log(chalk.blue("Producer/Distributor:"));
  console.log(chalk.yellow(dist));
 
  // Define the PowerShell executable name (use 'pwsh' for PowerShell Core, 'powershell.exe' for Windows PowerShell)
  const psExecutable = 'powershell.exe'; 
let location = discLetter;
let bfi = bfiIndicator
let title = movieTitleFinder;
let year = copyright;
let director = dirname;

let code = bfi  + "-" + location
let jobname = code

let latex = `\\def\\movietitle{${title}}\\def\\movieyear{${year}}\\def\\dir{${director}}\\def\\dist{${dist}}\\def\\discode{${code}}\\input{sleevemaster.tex}`;

  tmp.file(function _tempFileCreated(err, path, fd, cleanupCallback) {

      fs.writeFile(path, latex, (err: any) => {
        const child = spawn(psExecutable, ["pdflatex",
                "-interaction=nonstopmode",
                "-jobname=" + jobname,
                "--output-directory=output",
                path
                ]
              );
        });


  });
 

}

