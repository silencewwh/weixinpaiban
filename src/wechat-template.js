(function (root, factory) {
    var api = factory();

    if (typeof module === "object" && module.exports) {
        module.exports = api;
    }

    root.WechatTemplate = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    "use strict";

    var TEMPLATE_VERSION = "1.0.0";
    var FONT_STACK = "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei UI', 'Microsoft YaHei', Arial, sans-serif";
    var DEFAULTS = {
        title: "无标题",
        author: "未署名",
        date: "今天",
        lead: "",
        content: ""
    };

    function escapeHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function normalizeMultiline(value) {
        return String(value || "").replace(/\r\n/g, "\n").trim();
    }

    function normalizeArticleInput(input) {
        var source = input || {};

        return {
            title: normalizeMultiline(source.title) || "",
            author: normalizeMultiline(source.author) || "",
            date: normalizeMultiline(source.date) || "",
            lead: normalizeMultiline(source.lead),
            content: normalizeMultiline(source.content)
        };
    }

    function parseContent(content) {
        // Treat any newline as a block separator: single newline switches format
        return normalizeMultiline(content)
            .split(/\n+/)
            .map(function (block) { return block.trim(); })
            .filter(Boolean)
            .map(function (block) {
                if (block.indexOf("## ") === 0) {
                    return { type: "heading", text: block.slice(3).trim() };
                }

                if (block.indexOf("> ") === 0) {
                    return { type: "quote", text: block.slice(2).trim() };
                }

                if (/^-{3,}$/.test(block)) {
                    return { type: "divider", text: "" };
                }

                return { type: "paragraph", text: block };
            });
    }

    function renderInlineBreaks(text) {
        // Prefer a real Markdown inline renderer when available (Node require or browser global).
        try {
            if (typeof md !== "undefined" && md && typeof md.renderInline === "function") {
                return md.renderInline(text).replace(/\n/g, "<br>");
            }
        } catch (e) {
            // fall through to escape-based fallback
        }

        return escapeHtml(text).replace(/\n/g, "<br>");
    }

    // Attempt to load markdown-it in both Node and browser environments.
    var md = null;
    try {
        if (typeof require === "function") {
            var MarkdownIt = require("markdown-it");
            md = new MarkdownIt({ html: false, linkify: true, typographer: true });
        }
    } catch (e) {
        if (typeof window !== "undefined" && window.markdownit) {
            md = window.markdownit({ html: false, linkify: true, typographer: true });
        }
    }

    function summarizeBlocks(blocks) {
        return blocks.reduce(function (summary, block) {
            summary.totalBlocks += 1;

            if (block.type === "paragraph") {
                summary.paragraphs += 1;
            } else if (block.type === "heading") {
                summary.headings += 1;
            } else if (block.type === "quote") {
                summary.quotes += 1;
            } else if (block.type === "divider") {
                summary.dividers += 1;
            }

            return summary;
        }, {
            totalBlocks: 0,
            paragraphs: 0,
            headings: 0,
            quotes: 0,
            dividers: 0
        });
    }

    function renderBodyBlock(block) {
        if (block.type === "heading") {
            return [
                '<section style="margin: 20px 0 12px 0; text-align: center;">',
                '<h2 style="display: inline-block; margin: 0; padding: 6px 14px; font-size: 18px; color: #2c3e50; font-weight: bold; border-top: 1px solid #2c3e50; border-bottom: 1px solid #2c3e50; letter-spacing: 2px;">',
                escapeHtml(block.text),
                '</h2>',
                '</section>'
            ].join('');
        }

        if (block.type === "quote") {
            return [
                '<div style="margin-bottom: 80px;">',
                '<section style="margin: 40px 30px; position: relative;">',
                '<svg width="24" height="24" viewBox="0 0 24 24" fill="#e5e7eb" xmlns="http://www.w3.org/2000/svg" style="position: absolute; top: -10px; left: -20px; z-index: 0;">',
                '<path d="M10 11L8 15H11V19H5V15L7 11H5V7H11V11H10ZM21 11L19 15H22V19H16V15L18 11H16V7H22V11H21Z" fill="#e5e7eb"/>',
                '</svg>',
                '<p style="position: relative; z-index: 1; margin: 0; font-size: 16px; line-height: 2; color: #374151; font-family: \"Kaiti\", \"STKaiti\", serif;">',
                renderInlineBreaks(block.text),
                '</p>',
                '</section>',
                '</div>'
            ].join('');
        }

        if (block.type === "divider") {
            return [
                '<section style="text-align: center; margin: 40px 0;">',
                '<svg width="160" height="8" viewBox="0 0 160 8" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: inline-block;">',
                '<circle cx="80" cy="4" r="4" fill="#b91c1c"/>',
                '<circle cx="56" cy="4" r="2.5" fill="#111827"/>',
                '<circle cx="36" cy="4" r="1.5" fill="#6b7280"/>',
                '<circle cx="20" cy="4" r="1" fill="#d1d5db"/>',
                '<circle cx="104" cy="4" r="2.5" fill="#111827"/>',
                '<circle cx="124" cy="4" r="1.5" fill="#6b7280"/>',
                '<circle cx="140" cy="4" r="1" fill="#d1d5db"/>',
                '</svg>',
                '</section>'
            ].join('');
        }

        return [
            '<section style="margin: 0 0 12px;">',
            '<p style="margin: 0; color: #374151; font-size: 15px; line-height: 1.75; text-align: justify;">',
            renderInlineBreaks(block.text),
            "</p>",
            "</section>"
        ].join("");
    }

    function renderFooterSlot() {
        return [
            '<div style="margin-bottom: 80px;">',
            '<section style="border-top: 3px double #111827; padding-top: 12px; display: flex; justify-content: space-between; align-items: center;">',
            '<span style="font-size: 12px; font-weight: bold; color: #111827; letter-spacing: 1px;">VOL. 独立观察</span>',
            '<span style="font-size: 12px; color: #b91c1c; display: flex; align-items: center; font-weight: 500;">',
            '保持关注 <span style="display: inline-block; width: 4px; height: 4px; background: #b91c1c; border-radius: 50%; margin: 0 8px;"></span> 洞察本质',
            '</span>',
            '</section>',
            '</div>'
        ].join('');
    }

    function renderWechatArticleHtml(input) {
        var article = normalizeArticleInput(input);
        var blocks = parseContent(article.content);
        // 编者按 已移除：不再渲染导语块
        var leadHtml = "";
        var bodyHtml = blocks.length
            ? blocks.map(renderBodyBlock).join("")
            : '<section style="padding: 28px 0; color: #9ca3af; text-align: center; font-size: 14px;">正文为空，请输入内容。</section>';

        var headerHtml = '';
        if (article.title) {
            headerHtml += '<section style="padding: 28px 24px 36px;">';
            headerHtml += '<h1 style="margin: 0 0 14px; color: #111827; font-size: 30px; line-height: 1.35; font-weight: 800;">' + escapeHtml(article.title) + '</h1>';
        } else {
            headerHtml += '<section style="padding: 28px 24px 36px;">';
        }

        var metaHtml = '';
        if (article.author || article.date) {
            metaHtml += '<div style="display: flex; align-items: center; flex-wrap: wrap; gap: 12px; margin: 0 0 26px; color: #9ca3af; font-size: 13px;">';
            if (article.author) {
                metaHtml += '<span style="color: #576b95;">' + escapeHtml(article.author) + '</span>';
            }
            if (article.date) {
                metaHtml += '<span>' + escapeHtml(article.date) + '</span>';
            }
            metaHtml += '</div>';
        }

        return (
            '<article style="width: 100%; background: #ffffff; color: #333333; font-family: ' + FONT_STACK + '; line-height: 1.75; letter-spacing: 0.03em;">' +
                '<section style="padding: 28px 24px 6px; background: #ffffff; text-align: center; display: flex; flex-direction: column; align-items: center;">' +
                '<svg width="120" height="12" viewBox="0 0 120 12" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-bottom: 16px; display: block;">' +
                '<path d="M0 6H50" stroke="#111827" stroke-width="1"/>' +
                '<path d="M70 6H120" stroke="#111827" stroke-width="1"/>' +
                '<path d="M60 1L65 6L60 11L55 6Z" fill="#b91c1c"/>' +
                '</svg>' +
                '<section style="display: flex; flex-direction: column; align-items: center; border-bottom: 2px solid #111827; border-top: 2px solid #111827; padding: 10px 24px;">' +
                '<span data-diary-title="1" style="font-size: 22px; font-weight: 700; color: #111827; letter-spacing: 0.2em; line-height: 1.2; display: block; width: 100%; text-align: center;">池怀鱼观察日记</span>' +
                '<span style="font-size: 10px; color: #b91c1c; letter-spacing: 0.2em; margin-top: 4px; font-family: \"Times New Roman\", Times, serif; text-transform: uppercase; display: block;">Observation-Diary</span>' +
                '</section>' +
                '</section>' +
            headerHtml +
            metaHtml +
            leadHtml +
            '<section data-template-body="wechat-editorial">' +
            bodyHtml +
            renderFooterSlot() +
            '</section>' +
            '</section>' +
            '</article>'
        );
    }

    function renderWechatArticleDocument(input) {
        var article = normalizeArticleInput(input);

        return [
            "<!DOCTYPE html>",
            '<html lang="zh-CN">',
            "<head>",
            '<meta charset="UTF-8">',
            '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
            "<title>" + (article.title ? escapeHtml(article.title) : "") + "</title>",
            "</head>",
            '<body style="margin: 0; background: #f5f5f4; padding: 24px;">',
            '<div style="max-width: 760px; margin: 0 auto;">',
            renderWechatArticleHtml(article),
            "</div>",
            "</body>",
            "</html>"
        ].join("");
    }

    function renderPlainText(input) {
        var article = normalizeArticleInput(input);

        var authorDate = (article.author || article.date) ? (article.author + "  " + article.date) : "";

        return [
            article.title,
            authorDate,
            article.content
        ].filter(Boolean).join("\n\n");
    }

    function getTemplateSchema() {
        return {
            name: "wechat-editorial-template",
            version: TEMPLATE_VERSION,
            fields: [
                { name: "title", required: true, description: "文章标题" },
                { name: "author", required: true, description: "公众号名称或作者名" },
                { name: "date", required: true, description: "发布日期文本" },
                { name: "content", required: true, description: "正文，Markdown 格式，段落之间空一行" }
            ],
            contentSyntax: [
                { prefix: "## ", block: "heading", description: "生成红色竖条小标题" },
                { prefix: "> ", block: "quote", description: "生成强调金句块" },
                { prefix: "---", block: "divider", description: "生成段落分隔线" }
            ],
            notes: [
                "输出为适合微信公众号编辑器粘贴的内联样式 HTML 片段。",
                "正文采用 Markdown 格式（支持标题、引用、列表、加粗、斜体、链接等常见语法），预览与导出使用相同渲染逻辑。",
                "模板正文末尾默认附带底栏结语作为结语与关注引导。"
            ]
        };
    }

    function renderWechatArticleResult(input, options) {
        var article = normalizeArticleInput(input);
        var blocks = parseContent(article.content);
        var includeDocument = Boolean(options && options.includeDocument);
        var summary = summarizeBlocks(blocks);

        return {
            article: article,
            stats: {
                blocks: summary,
                characters: renderPlainText(article).length
            },
            html: renderWechatArticleHtml(article),
            documentHtml: includeDocument ? renderWechatArticleDocument(article) : undefined,
            plainText: renderPlainText(article)
        };
    }

    return {
        TEMPLATE_VERSION: TEMPLATE_VERSION,
        normalizeArticleInput: normalizeArticleInput,
        parseContent: parseContent,
        renderWechatArticleHtml: renderWechatArticleHtml,
        renderWechatArticleDocument: renderWechatArticleDocument,
        renderWechatArticleResult: renderWechatArticleResult,
        renderPlainText: renderPlainText,
        getTemplateSchema: getTemplateSchema
    };
});
