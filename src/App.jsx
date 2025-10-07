// src/App.jsx
import React, { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import "./App.css";

/**
 * remark-плагин: распознаёт LaTeX-подобные фрагменты в тексте
 * и превращает их в inlineMath / math узлы mdast.
 *
 * Правила:
 * - Ищем "семена" формул: \xxx, \frac, \text{...}, _{...}, ^{...}, цифры с запятой и пр.
 * - Расширяем область вокруг такого семени вправо/влево, захватывая операторы, знаки равенства, пробелы, цифры, скобки, \-команды и т.д.
 * - Нормализуем десятичную запятую внутри математики: 9,8 -> 9.8 (можно отключить, если не нужно).
 * - Не трогаем узлы типа code / inlineCode / html.
 */
function remarkSmartMath({ normalizeCommaInsideMath = true } = {}) {
  return (tree) => {
    // рекурсивный обход
    function walk(node) {
      if (!node || !node.children) return;
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];

        // безопасно пропускаем блоки кода, inline-код и html
        if (
          child.type === "code" ||
          child.type === "inlineCode" ||
          child.type === "html"
        ) {
          continue;
        }

        if (child.type === "text") {
          const text = child.value;

          // быстрый фильтр: если в тексте нет ничего похожего на LaTeX — пропускаем
          if (
            !/[\\\^_\{\}]|\\frac|\\sqrt|\\text\{|\\sin|\\cos|\d,\d/.test(text)
          ) {
            continue;
          }

          // regex для "семян" — места, где наверняка начинается LaTeX-паттерн
          const seedRe =
            /\\[a-zA-Z]+|\\frac|\\sqrt|\\text\{|\w+_\{[^}]*\}|\w+\^\{[^}]*\}|\d,\d/gi;
          let m;
          let lastIndex = 0;
          const newNodes = [];
          let any = false;

          while ((m = seedRe.exec(text)) !== null) {
            const seedIndex = m.index;

            // добавляем текст до семени
            if (seedIndex > lastIndex) {
              newNodes.push({
                type: "text",
                value: text.slice(lastIndex, seedIndex),
              });
            }

            // теперь расширяем фрагмент: возьмём слева/справа от seed набор символов,
            // которые обычно входят в математическое выражение.
            // Допустимые символы в расширении:
            // буквы, цифры, пробелы, знаки + - * / = < > ( ) [ ] { } ^ _ \ . , ° % \text{...} и т.д.
            // Остановимся на ближайших символах-разделителях (точка, ;, : , перевод строки — возможный конец предложения)
            const leftLimitChars = ".,;:!?\\n";
            let start = seedIndex;
            // идём влево, пока не встретим разделитель предложения (или начало строки)
            while (start > lastIndex) {
              const ch = text[start - 1];
              if (leftLimitChars.includes(ch)) break;
              start--;
            }

            // идём вправо, пока не встретим разделитель предложения или конец строки
            let end = seedRe.lastIndex;
            while (end < text.length) {
              const ch = text[end];
              if (leftLimitChars.includes(ch)) break;
              // если встретили двойной пробел — считаем, что предложение может закончиться
              if (ch === "\u00A0") break;
              end++;
            }

            // Обрезаем пробелы по краям
            while (start < seedIndex && /\s/.test(text[start])) start++;
            while (end > seedIndex && /\s/.test(text[end - 1])) end--;

            // Получаем кандидат на формулу
            let candidate = text.slice(start, end);

            // Уточняем эвристику: кандидат должен содержать хотя бы одну LaTeX-особенность
            const mathLike =
              /\\|_|\\frac|\\sqrt|\\text\{|\^|[=<>]|\\sin|\\cos|\\tan|\\alpha|\\beta|\\gamma|\d,\d/.test(
                candidate
              );

            if (mathLike) {
              // Нормализация десятичной запятой только внутри математики
              if (normalizeCommaInsideMath) {
                candidate = candidate.replace(/(\d),(\d)/g, "$1.$2");
              }

              // Если внутри есть перенос строки — считаем display math
              if (/\n/.test(candidate) || /^\s*\[|\]\s*$/.test(candidate)) {
                // display math
                newNodes.push({ type: "math", value: candidate.trim() });
              } else {
                newNodes.push({ type: "inlineMath", value: candidate.trim() });
              }
              any = true;
            } else {
              // Не похоже на математику — вставляем как текст (оставляем исходно)
              newNodes.push({ type: "text", value: text.slice(start, end) });
            }

            lastIndex = end;
            // сдвигаем указатель seedRe, чтобы продолжить поиск дальше
            seedRe.lastIndex = end;
          } // while seed

          if (any) {
            // добавляем остаток
            if (lastIndex < text.length) {
              newNodes.push({ type: "text", value: text.slice(lastIndex) });
            }
            // заменяем один узел на массив узлов
            node.children.splice(i, 1, ...newNodes);
            i += newNodes.length - 1;
          }
        } else {
          // рекурсивно обработать вложенные узлы (paragraph, strong, emphasis и т.д.)
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
            remarkPlugins={[
              [remarkSmartMath, { normalizeCommaInsideMath: true }],
              remarkMath,
            ]}
            rehypePlugins={[rehypeKatex]}
          >
            {content}
          </ReactMarkdown>
        </div>
      </main>
    </div>
  );
}
