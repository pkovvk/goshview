import React, { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import "./App.css";

export default function App() {
  const [content, setContent] = useState("Загрузка...");

  // Функция для декодирования base64 (URL-safe)
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
            remarkPlugins={[remarkMath]}
            rehypePlugins={[rehypeKatex]}
          >
            {content}
          </ReactMarkdown>
        </div>
      </main>
    </div>
  );
}
