import path from 'path';
import os from 'os';
import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import { Liquid } from 'liquidjs';
import crypto from 'crypto';

const liquid = new Liquid();

const svg = fs.readFile('./src/card.svg', 'utf8').then(svg => {
  return liquid.parse(svg);
});

async function path_exists(path: string) {
  try {
    await fs.access(path, fs.constants.R_OK | fs.constants.W_OK);
    return true;
  } catch (e) {
    return false;
  }
}

type RenderOptions = {
  title: string;
  fullname: string;
  avatar: string;
  slug: string;
  date: Date
};

const browser = puppeteer.launch({
  headless: true
});

type DateTimeFormatOptions = {
  year: 'numeric';
  month: 'short';
  day: 'numeric'
};

function formatDate(lang: string, date: Date) {
  const options: DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
  return date.toLocaleDateString(lang, options);
}

const delay = (time: number) => new Promise(resolve => setTimeout(resolve, time));

function mktemp(suffix: string) {
  const prefix = crypto.randomBytes(4).readUInt32LE(0);
  return path.join(os.tmpdir(), `${prefix}-${suffix}`);
}

export default async function render({ title, fullname, avatar, slug, date }: RenderOptions) {
  const output_svg = await liquid.render(await svg, {
    fullname,
    title,
    avatar,
    date: formatDate('en-US', date)
  });
  const svg_fullname = mktemp('docusaurs.svg');
  await fs.writeFile(svg_fullname, output_svg);
  const directory = `build/img/`;
  if (!await path_exists(directory)) {
    await fs.mkdir(directory, { recursive: true });
  }
  const filename = `${directory}${slug}.png`;
  const page = await (await browser).newPage();
  await page.setViewport({
    height: 630,
    width: 1200
  });
  await page.goto('file://' + svg_fullname);
  await delay(100);

  const imageBuffer = await page.screenshot({});

  await fs.writeFile(filename, imageBuffer);
  await fs.unlink(svg_fullname);

  console.log(`[Docusaurs] Writing ${filename}`);
  await page.close();
}
