"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
    getTemplateSchema,
    renderWechatArticleDocument,
    renderWechatArticleResult
} = require("../src/wechat-template.js");

test("renderWechatArticleResult renders headings, quotes, dividers, and escapes HTML", () => {
    const result = renderWechatArticleResult({
        title: "测试标题",
        author: "测试作者",
        date: "2026-04-06",
        lead: "导语<script>",
        content: "## 小标题\n\n> 引用内容\n\n---\n\n正文<script>alert(1)</script>"
    }, { includeDocument: true });

    assert.match(result.html, /data-template-body="wechat-editorial"/);
    assert.match(result.html, /小标题/);
    assert.match(result.html, /引用内容/);
    assert.match(result.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.match(result.html, /VOL\. 独立观察/);
    assert.ok(result.documentHtml.includes("<!DOCTYPE html>"));
    assert.equal(result.stats.blocks.headings, 1);
    assert.equal(result.stats.blocks.quotes, 1);
    assert.equal(result.stats.blocks.dividers, 1);
});

test("getTemplateSchema describes the supported syntax", () => {
    const schema = getTemplateSchema();

    assert.equal(schema.name, "wechat-editorial-template");
    assert.equal(schema.contentSyntax.length, 3);
    assert.equal(schema.fields[0].name, "title");
});

test("renderWechatArticleDocument wraps the fragment in a full HTML shell", () => {
    const html = renderWechatArticleDocument({
        title: "完整文档",
        author: "作者",
        date: "今天",
        lead: "",
        content: "正文"
    });

    assert.match(html, /<!DOCTYPE html>/);
    assert.match(html, /<title>完整文档<\/title>/);
    assert.match(html, /正文/);
});
