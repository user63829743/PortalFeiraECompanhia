import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../apps/portal-publico/public/noticias");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const script = fs.readFileSync(path.join(root, "noticia.js"), "utf8");
const css = fs.readFileSync(path.join(root, "noticia.css"), "utf8");

test("leitor individual contém metadados editoriais e publicidade na composição", () => {
  assert.doesNotMatch(html, /id="noticiaLocal"/);
  assert.match(html, /id="noticiaCategoria"/);
  assert.match(html, /id="noticiaTitulo"/);
  assert.match(html, /id="noticiaData"/);
  assert.match(html, /id="bannerNoticiaTopo"/);
  assert.match(html, /id="noticiaImagem"/);
  assert.match(html, /id="bannerNoticiaLateral"/);
  assert.match(script, /article\.author/);
  assert.doesNotMatch(script, /article\.location/);
  assert.match(script, /loadArticleBanners/);
  assert.match(css, /noticia-leitura-layout/);
  assert.match(css, /noticia-sidebar/);
});
