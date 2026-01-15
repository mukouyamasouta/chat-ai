"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface Message {
  id: string;
  content: string;
  sender: "user" | "ai";
  timestamp: Date;
}

interface Suggestion {
  number: string;
  text: string;
  explanation: string;
}

interface Client {
  id: string;
  name: string;
  status: "新規" | "常連" | "VIP";
  memo: string;
  createdAt: Date;
  messages: Message[];
}

export default function Home() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // クライアントデータをlocalStorageから読み込み
  useEffect(() => {
    const saved = localStorage.getItem("chatai_clients");
    if (saved) {
      const parsed = JSON.parse(saved);
      const restored = parsed.map((c: Client) => ({
        ...c,
        createdAt: new Date(c.createdAt),
        messages: c.messages.map((m: Message) => ({
          ...m,
          timestamp: new Date(m.timestamp),
        })),
      }));
      setClients(restored);
    }
  }, []);

  // クライアントデータをlocalStorageに保存
  const saveClients = useCallback((clientsToSave: Client[]) => {
    localStorage.setItem("chatai_clients", JSON.stringify(clientsToSave));
  }, []);

  // clientsのrefを保持（useEffect内で最新値を参照するため）
  const clientsRef = useRef(clients);
  useEffect(() => {
    clientsRef.current = clients;
  }, [clients]);

  // 選択中のクライアントのメッセージを更新
  useEffect(() => {
    if (selectedClient && messages.length > 0) {
      const currentClients = clientsRef.current;
      const updated = currentClients.map((c) =>
        c.id === selectedClient.id ? { ...c, messages } : c
      );
      // 変更があった時のみ更新
      const hasChanged = JSON.stringify(updated) !== JSON.stringify(currentClients);
      if (hasChanged) {
        setClients(updated);
        saveClients(updated);
      }
    }
  }, [messages, selectedClient, saveClients]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, suggestions]);

  // 返信候補をパースする関数
  const parseSuggestions = (text: string): Suggestion[] => {
    const results: Suggestion[] = [];
    const pattern = /【候補(\d)】([\s\S]*?)(?=【候補\d】|$)/g;
    let match;

    while ((match = pattern.exec(text)) !== null) {
      const number = match[1];
      const fullText = match[2].trim();
      const lines = fullText.split("\n").filter((l) => l.trim());
      const mainText = lines[0] || "";
      const explanation = lines.slice(1).join(" ") || "";

      results.push({ number, text: mainText, explanation });
    }

    return results;
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setSuggestions([]);

    try {
      const conversationHistory = messages
        .map((m) => `${m.sender === "user" ? "ユーザー" : "AI"}: ${m.content}`)
        .join("\n");

      const clientContext = selectedClient
        ? `クライアント: ${selectedClient.name} (${selectedClient.status})\nメモ: ${selectedClient.memo || "なし"}`
        : "";

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: input,
          conversationHistory,
          clientContext,
        }),
      });

      const data = await response.json();

      if (data.error) {
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: `エラー: ${data.error}`,
          sender: "ai",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } else {
        const parsed = parseSuggestions(data.suggestions);
        if (parsed.length > 0) {
          setSuggestions(parsed);
        } else {
          const aiMessage: Message = {
            id: (Date.now() + 1).toString(),
            content: data.suggestions,
            sender: "ai",
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, aiMessage]);
        }
      }
    } catch {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "通信エラーが発生しました",
        sender: "ai",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    }

    setIsLoading(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setInput((prev) => prev + (prev ? "\n" : "") + content);
    };
    reader.readAsText(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleCopySuggestion = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleSelectSuggestion = (suggestion: Suggestion) => {
    const aiMessage: Message = {
      id: Date.now().toString(),
      content: `【選択した返信】\n${suggestion.text}`,
      sender: "ai",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, aiMessage]);
    setSuggestions([]);
  };

  const handleAddClient = () => {
    if (!newClientName.trim()) return;

    const newClient: Client = {
      id: Date.now().toString(),
      name: newClientName,
      status: "新規",
      memo: "",
      createdAt: new Date(),
      messages: [],
    };

    const updated = [newClient, ...clients];
    setClients(updated);
    saveClients(updated);
    setSelectedClient(newClient);
    setMessages([]);
    setNewClientName("");
    setShowNewClientModal(false);
  };

  const handleSelectClient = (client: Client) => {
    setSelectedClient(client);
    setMessages(client.messages);
    setSuggestions([]);
  };

  const handleDeleteClient = (clientId: string) => {
    const updated = clients.filter((c) => c.id !== clientId);
    setClients(updated);
    saveClients(updated);
    if (selectedClient?.id === clientId) {
      setSelectedClient(null);
      setMessages([]);
    }
  };

  return (
    <div className="flex h-screen bg-gray-900">
      {/* サイドバー */}
      <div
        className={`${sidebarOpen ? "w-64" : "w-0"} transition-all duration-300 bg-gray-800 border-r border-gray-700 overflow-hidden`}
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-bold">👥 クライアント</h2>
            <button
              onClick={() => setShowNewClientModal(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-sm"
            >
              + 追加
            </button>
          </div>

          <div className="space-y-2">
            {clients.map((client) => (
              <div
                key={client.id}
                onClick={() => handleSelectClient(client)}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${selectedClient?.id === client.id
                  ? "bg-purple-600"
                  : "bg-gray-700 hover:bg-gray-600"
                  }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-white font-medium">{client.name}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteClient(client.id);
                    }}
                    className="text-gray-400 hover:text-red-400 text-sm"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${client.status === "VIP"
                      ? "bg-yellow-600"
                      : client.status === "常連"
                        ? "bg-green-600"
                        : "bg-gray-500"
                      }`}
                  >
                    {client.status}
                  </span>
                  <span className="text-gray-400 text-xs">
                    {client.messages.length}件
                  </span>
                </div>
              </div>
            ))}

            {clients.length === 0 && (
              <p className="text-gray-500 text-sm text-center py-4">
                クライアントがいません
              </p>
            )}
          </div>
        </div>
      </div>

      {/* メインエリア */}
      <div className="flex-1 flex flex-col">
        {/* ヘッダー */}
        <header className="bg-gray-800 text-white p-4 shadow-lg flex items-center gap-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-white hover:bg-gray-700 p-2 rounded"
          >
            ☰
          </button>
          <div>
            <h1 className="text-xl font-bold">
              💬 チャットAI
              {selectedClient && ` - ${selectedClient.name}`}
            </h1>
            <p className="text-sm text-gray-400">
              売れっ子ホストのLINE術で返信提案
            </p>
          </div>
        </header>

        {/* メッセージエリア */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 mt-10">
              <p className="text-lg">
                👋 女性からのメッセージを入力してください
              </p>
              <p className="text-sm mt-2">
                テキスト入力、またはtxtファイルをアップロードできます
              </p>
              {!selectedClient && (
                <p className="text-sm mt-4 text-purple-400">
                  💡 左のサイドバーからクライアントを追加すると会話履歴が保存されます
                </p>
              )}
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 ${message.sender === "user"
                  ? "bg-green-500 text-white rounded-br-sm"
                  : "bg-gray-700 text-white rounded-bl-sm"
                  }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
                <p className="text-xs opacity-70 mt-1">
                  {message.timestamp.toLocaleTimeString("ja-JP", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-700 rounded-2xl px-4 py-3 rounded-bl-sm">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0.1s" }}
                  ></div>
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  ></div>
                </div>
              </div>
            </div>
          )}

          {suggestions.length > 0 && (
            <div className="space-y-3">
              <p className="text-gray-400 text-sm">
                💡 返信候補（クリックで選択、右のボタンでコピー）
              </p>
              {suggestions.map((suggestion) => (
                <div
                  key={suggestion.number}
                  className="bg-gray-800 border border-gray-600 rounded-xl p-4 hover:border-purple-500 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() => handleSelectSuggestion(suggestion)}
                    >
                      <span className="inline-block bg-purple-600 text-white text-xs px-2 py-1 rounded-full mb-2">
                        候補 {suggestion.number}
                      </span>
                      <p className="text-white font-medium">{suggestion.text}</p>
                      {suggestion.explanation && (
                        <p className="text-gray-400 text-sm mt-2">
                          {suggestion.explanation}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleCopySuggestion(suggestion.text)}
                      className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg text-sm transition-colors"
                      title="コピー"
                    >
                      📋
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 入力エリア */}
        <div className="bg-gray-800 p-4 border-t border-gray-700">
          <div className="flex items-end gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".txt"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-gray-700 hover:bg-gray-600 text-white p-3 rounded-full transition-colors"
              title="txtファイルをアップロード"
            >
              📎
            </button>

            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="女性からのメッセージを入力..."
              className="flex-1 bg-gray-700 text-white rounded-2xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
              rows={1}
              style={{ maxHeight: "120px" }}
            />

            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white p-3 rounded-full transition-colors"
            >
              {isLoading ? "⏳" : "➤"}
            </button>
          </div>
        </div>
      </div>

      {/* 新規クライアント追加モーダル */}
      {showNewClientModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 w-80">
            <h3 className="text-white font-bold mb-4">新規クライアント追加</h3>
            <input
              type="text"
              value={newClientName}
              onChange={(e) => setNewClientName(e.target.value)}
              placeholder="名前を入力..."
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-purple-500"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowNewClientModal(false)}
                className="flex-1 bg-gray-600 hover:bg-gray-500 text-white py-2 rounded-lg"
              >
                キャンセル
              </button>
              <button
                onClick={handleAddClient}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg"
              >
                追加
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
