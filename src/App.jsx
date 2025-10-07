// src/App.jsx
import React, { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import "./App.css";

/**
 * remark-плагин: превращает [ ... ] -> inlineMath и [[ ... ]] -> math
 * работает на mdast, не трогает code/pre и учитывает "математические" признаки.
 */
function remarkBracketMath() {
  return (tree) => {
    // рекурсивно обходим узлы
    function walk(node) {
      if (!node || !node.children) return;
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];

        // не трогаем код, pre, html и т.п.
        if (
          child.type === "code" ||
          child.type === "inlineCode" ||
          child.type === "html"
        ) {
          continue;
        }

        if (child.type === "text") {
          const text = child.value;
          // матчим сначала [[...]] (display), затем [...] (inline)
          const regex = /\[\[([\s\S]*?)\]\]|\[([^\]\[]+?)\]/g;
          let match;
          let lastIndex = 0;
          const newNodes = [];
          let anyReplace = false;

          while ((match = regex.exec(text)) !== null) {
            const matchStart = match.index;
            const wholeMatch = match[0];
            const inner = match[1] ?? match[2]; // group1 => [[...]], group2 => [...]
            const isDisplay = Boolean(match[1]);

            // текст перед совпадением
            if (matchStart > lastIndex) {
              newNodes.push({
                type: "text",
                value: text.slice(lastIndex, matchStart),
              });
            }

            // эвристика: внутри должно быть что-то, характерное для LaTeX
            const isMathLike =
              /\\|[\^_{}]|\\frac|\\sin|\\cos|\\tan|\\alpha|\\beta|\\gamma|\\sqrt|\\sum|\\int|\\cdot/.test(
                inner
              );

            if (isMathLike) {
              // нормализуем десятичную запятую (только внутри формулы) -> точки
              const normalized = inner.replace(/(\d),(\d)/g, "$1.$2");
              if (isDisplay) {
                newNodes.push({ type: "math", value: normalized });
              } else {
                newNodes.push({ type: "inlineMath", value: normalized });
              }
              anyReplace = true;
            } else {
              // не похоже на формулу — оставляем как есть (с квадратными скобками)
              newNodes.push({ type: "text", value: wholeMatch });
            }

            lastIndex = matchStart + wholeMatch.length;
          }

          if (anyReplace) {
            // остаток после последнего совпадения
            if (lastIndex < text.length) {
              newNodes.push({ type: "text", value: text.slice(lastIndex) });
            }
            // заменяем один узел текст на получившиеся узлы
            node.children.splice(i, 1, ...newNodes);
            // сдвигаем индекс, чтобы не пропустить следующие вставленные узлы
            i += newNodes.length - 1;
          }
        } else {
          // рекурсивно обработать дочерние узлы (параграфы, списки и т.д.)
          walk(child);
        }
      }
    }

    walk(tree);
  };
}

export default function App() {
  const [content, setContent] = useState("Загрузка...");

  function base64ToUtf8(str) {
    if (!str) return null;
    str = str.replace(/-/g, "+").replace(/_/g, "/");
    while (str.length % 4) str += "=";
    try {
      const bytes = atob(str);
      return new TextDecoder("utf-8").decode(
        Uint8Array.from(bytes, (c) => c.charCodeAt(0))
      );
    } catch {
      return null;
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const data = params.get("data");
    if (data) {
      const decoded = base64ToUtf8(data);
      if (decoded) setContent(decoded);
      else setContent("❌ Ошибка декодирования данных.");
    } else {
      setContent("ℹ️ Нет данных для отображения.");
    }
  }, []);

  return (
    <div className="app">
      <header>
        <img src="/logo.png" alt="Логотип" className="logo" />
      </header>

      <main>
        <div className="answer">
          <ReactMarkdown
            remarkPlugins={[remarkBracketMath, remarkMath]}
            rehypePlugins={[rehypeKatex]}
          >
            {content}
          </ReactMarkdown>
        </div>
      </main>
    </div>
  );
}
