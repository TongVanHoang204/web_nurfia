import { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, X, Bot, User, Loader2, ShoppingBag, Maximize2, Minimize2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import api from '../../api/client';
import { useAuthStore } from '../../stores/authStore';
import './AIChatbot.css';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

const QUICK_REPLIES = [
  "How much is shipping?",
  "Return policy?",
  "Where is your store?"
];

// Helper to parse content with embedded product cards
const renderMessageContent = (content: string) => {
  // Regex matches [PRODUCT|id|name|price|image_url|slug]
  const productRegex = /(\[PRODUCT\|[^\]]+\])/g;
  const parts = content.split(productRegex);

  return parts.map((part, idx) => {
    if (part.startsWith('[PRODUCT|') && part.endsWith(']')) {
      const data = part.substring(9, part.length - 1).split('|');
      const [id, name, price, image, slug] = data;
      
      return (
        <Link to={`/product/${slug}`} key={idx} className="ai-product-card">
          <div className="ai-product-img">
            {image ? <img src={image} alt={name} /> : <ShoppingBag size={24} />}
          </div>
          <div className="ai-product-info">
            <h4>{name}</h4>
            <span className="price">${Number(price).toFixed(2)}</span>
          </div>
        </Link>
      );
    }
    return <ReactMarkdown key={idx}>{part}</ReactMarkdown>;
  });
};

export default function AIChatbot() {
  const { isAuthenticated } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hello! I am Nurfia AI. How can I help you with your shopping today? (I also speak Vietnamese, Spanish, etc.)'
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Shrink when there is window resize to avoid overlapping
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768 && isMaximized) {
        setIsMaximized(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMaximized]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  if (!isAuthenticated) return null;

  const handleSend = async (overrideInput?: string) => {
    const textToSend = overrideInput || input;
    if (!textToSend.trim() || isTyping) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: textToSend.trim()
    };

    setMessages(prev => [...prev, userMessage]);
    if (!overrideInput) setInput('');
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
        id: `error-${Date.now()}`,
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
      <div className={`ai-chatbot-window ${isMaximized ? 'is-maximized' : ''}`}>
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
          <div className="header-actions">
            <button onClick={() => setIsMaximized(!isMaximized)} className="close-btn" title="Toggle size" aria-label="Toggle size">
              {isMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            <button onClick={() => setIsOpen(false)} className="close-btn" title="Close chat" aria-label="Close chat">
              <X size={20} />
            </button>
          </div>
        </header>

        <div className="ai-chatbot-messages" ref={scrollRef}>
          {messages.map((msg) => (
            <div key={msg.id} className={`ai-chat-msg ${msg.role}`}>
              <div className="msg-icon">
                {msg.role === 'assistant' ? <Bot size={14} /> : <User size={14} />}
              </div>
              <div className={`msg-bubble ${msg.role === 'assistant' ? 'markdown-body' : ''}`}>
                {msg.role === 'assistant' ? (
                  renderMessageContent(msg.content)
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="ai-chat-msg assistant typing">
              <div className="msg-icon"><Bot size={14} /></div>
              <div className="msg-bubble">
                <Loader2 size={16} className="spinner" />
                <span>AI is thinking...</span>
              </div>
            </div>
          )}
        </div>

        <div className="ai-chatbot-footer">
          {messages.length < 3 && !isTyping && (
            <div className="quick-replies">
              {QUICK_REPLIES.map((reply, i) => (
                <button 
                  key={i} 
                  className="quick-reply-btn"
                  onClick={() => handleSend(reply)}
                >
                  {reply}
                </button>
              ))}
            </div>
          )}
          <div className="ai-chatbot-input">
            <input 
              type="text" 
              placeholder="Ask me anything in any language..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />
            <button onClick={() => handleSend()} disabled={!input.trim() || isTyping} title="Send message" aria-label="Send message">
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
