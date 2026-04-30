import { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, X, Bot, User, Loader2 } from 'lucide-react';
import api from '../../api/client';
import './AIChatbot.css';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

export default function AIChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hello! I am Nurfia AI. How can I help you with your shopping today?'
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      // Create chat history for the AI
      const history = messages.slice(-5).map(m => ({
        role: m.role,
        content: m.content
      }));

      const { data } = await api.post('/ai/chat', {
        message: userMessage.content,
        history
      });

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.data
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (err) {
      setMessages(prev => [...prev, {
        id: 'error',
        role: 'assistant',
        content: 'Sorry, the AI system is currently busy. Please try again in a moment!'
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className={`ai-chatbot-wrapper ${isOpen ? 'is-open' : ''}`}>
      {/* Chat Toggle Button */}
      <button 
        className="ai-chatbot-toggle" 
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle AI Assistant"
      >
        {isOpen ? <X size={24} /> : <MessageSquare size={24} />}
        {!isOpen && <span className="ai-chatbot-badge">AI</span>}
      </button>

      {/* Chat Window */}
      <div className="ai-chatbot-window">
        <header className="ai-chatbot-header">
          <div className="ai-chatbot-brand">
            <div className="ai-chatbot-avatar">
              <Bot size={20} />
            </div>
            <div>
              <h3>Nurfia AI</h3>
              <span className="online-indicator">Online Assistant</span>
            </div>
          </div>
          <button onClick={() => setIsOpen(false)} className="close-btn">
            <X size={20} />
          </button>
        </header>

        <div className="ai-chatbot-messages" ref={scrollRef}>
          {messages.map((msg) => (
            <div key={msg.id} className={`ai-chat-msg ${msg.role}`}>
              <div className="msg-icon">
                {msg.role === 'assistant' ? <Bot size={14} /> : <User size={14} />}
              </div>
              <div className="msg-bubble">
                {msg.content}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="ai-chat-msg assistant typing">
              <div className="msg-icon"><Bot size={14} /></div>
              <div className="msg-bubble">
                <Loader2 size={16} className="spinner" />
                <span>Thinking...</span>
              </div>
            </div>
          )}
        </div>

        <div className="ai-chatbot-input">
          <input 
            type="text" 
            placeholder="Ask me anything..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          />
          <button onClick={handleSend} disabled={!input.trim() || isTyping}>
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
