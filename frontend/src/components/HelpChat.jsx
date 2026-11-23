import { useEffect, useRef, useState } from 'react';
import { Bot, MessageCircle, Send, X } from 'lucide-react';

const HELP_TOPICS = [
  {
    keywords: ['forecast', 'prediction', 'predict', 'future', 'model'],
    page: 'Revenue Prediction',
    answer: 'Open Revenue Prediction to forecast revenue for the next 3, 6, or 12 months. Model Comparison shows evaluation metrics for the available forecasting models.'
  },
  {
    keywords: ['category', 'categories', 'subcategory', 'subcategories'],
    page: 'Categories',
    answer: 'Open Categories to browse the category catalog. Choose a main category, such as Electronics, to see its subcategories and example items.'
  },
  {
    keywords: ['upload', 'import', 'csv', 'dataset', 'data management'],
    page: 'Data Management',
    answer: 'Administrators can open Data Management, download the CSV template, then upload or paste a file and select Process CSV. Required fields include order ID, date, product, category, quantity, revenue, customer, and profit. Duplicate order IDs are rejected.'
  },
  {
    keywords: ['filter', 'date range', 'region', 'search'],
    page: 'Dashboard',
    answer: 'Use the filters above the page to narrow results by date, product, category, and region. Choose Custom range to enter dates, or Clear filters to reset them.'
  },
  {
    keywords: ['report', 'export', 'print', 'pdf', 'download'],
    page: 'Reports',
    answer: 'Open Reports to review sales records and export a report. Exports follow the current date, product, category, region, and search filters.'
  },
  {
    keywords: ['customer', 'customers'],
    page: 'Customers',
    answer: 'Open Customers to explore customer spending and customer-level sales insights.'
  },
  {
    keywords: ['profit', 'revenue'],
    page: 'Revenue & Profit',
    answer: 'Open Revenue & Profit to review revenue and profit trends. The Dashboard also summarizes revenue, profit, orders, units sold, average order value, and growth.'
  },
  {
    keywords: ['product', 'products', 'item', 'items'],
    page: 'Products',
    answer: 'Open Products and use the Product category selector to browse all products or narrow the list to a category such as Electronics or Furniture. Each product shows its subcategory and sales figures. The Categories page also shows example items for each subcategory.'
  },
  {
    keywords: ['season', 'seasonal'],
    page: 'Seasonal Analysis',
    answer: 'Open Seasonal Analysis to explore sales patterns across the reporting period.'
  },
  {
    keywords: ['eda', 'exploratory', 'statistics', 'correlation'],
    page: 'EDA',
    answer: 'Open EDA for statistical summaries and exploratory analysis of the loaded sales dataset.'
  },
  {
    keywords: ['admin', 'administrator', 'role', 'permission', 'user access'],
    page: 'Admin',
    answer: 'The Admin page is available to administrator accounts for user-role management. New accounts are regular users unless their email matches the configured administrator email.'
  },
  {
    keywords: ['password', 'profile', 'theme', 'notification', 'settings'],
    page: 'Settings',
    answer: 'Open Settings to update your profile, change your password, and manage appearance and notification preferences. Use Forgot password on the login screen if you cannot sign in.'
  },
  {
    keywords: ['dashboard', 'overview', 'kpi', 'kpis', 'start'],
    page: 'Dashboard',
    answer: 'The Dashboard is the business overview. It includes sales KPIs and revenue, sales, product, and category summaries. Use the filters above it to focus on a date range, product, category, or region.'
  },
  {
    keywords: ['login', 'sign in', 'register', 'account'],
    answer: 'Sign in with your registered email and password, or choose Register to create an account. If you have forgotten your password, choose Forgot password; password recovery requires email delivery to be configured.'
  }
];

const SUGGESTED_QUESTIONS = [
  'How do I upload a CSV?',
  'How do revenue predictions work?',
  'Where can I see categories and subcategories?'
];

function getHelpReply(question) {
  const normalizedQuestion = question.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const topic = HELP_TOPICS.find(({ keywords }) => keywords.some((keyword) => (
    normalizedQuestion.includes(keyword)
  )));

  if (topic) return topic;
  return {
    answer: 'I can help explain REVORA features and where to find them. Try asking about the dashboard, products, categories, CSV imports, filters, reports, customers, settings, or revenue predictions.'
  };
}

function HelpChat({ onNavigate }) {
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([
    {
      id: 0,
      sender: 'assistant',
      text: 'Hi! I’m REVORA Help. Ask me how to use a feature or where to find something in the app.'
    }
  ]);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (isOpen) messagesEndRef.current?.scrollIntoView({ block: 'nearest' });
  }, [isOpen, messages]);

  const sendQuestion = (event, suggestedQuestion = question) => {
    event?.preventDefault();
    const text = suggestedQuestion.trim();
    if (!text) return;

    const reply = getHelpReply(text);
    setMessages((current) => [
      ...current,
      { id: current.length, sender: 'user', text },
      { id: current.length + 1, sender: 'assistant', text: reply.answer, page: reply.page }
    ]);
    setQuestion('');
  };

  return (
    <div className="help-chat no-print">
      {isOpen && (
        <section className="help-chat-panel" aria-label="REVORA Help chat">
          <header className="help-chat-header">
            <div className="help-chat-title">
              <span className="help-chat-avatar"><Bot size={19} aria-hidden="true" /></span>
              <span><strong>REVORA Help</strong><small>App questions and guidance</small></span>
            </div>
            <button type="button" className="help-chat-close" aria-label="Close help chat" onClick={() => setIsOpen(false)}>
              <X size={18} />
            </button>
          </header>

          <div className="help-chat-messages" aria-live="polite">
            {messages.map((message) => (
              <div className={`help-chat-message ${message.sender}`} key={message.id}>
                <p>{message.text}</p>
                {message.page && onNavigate && (
                  <button type="button" className="help-chat-page-link" onClick={() => onNavigate(message.page)}>
                    Open {message.page}
                  </button>
                )}
              </div>
            ))}
            {messages.length === 1 && (
              <div className="help-chat-suggestions">
                <span>Try asking</span>
                {SUGGESTED_QUESTIONS.map((suggestion) => (
                  <button type="button" key={suggestion} onClick={(event) => sendQuestion(event, suggestion)}>
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form className="help-chat-form" onSubmit={sendQuestion}>
            <input
              aria-label="Ask REVORA Help a question"
              placeholder="Ask a question..."
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
            />
            <button type="submit" aria-label="Send question" disabled={!question.trim()}>
              <Send size={17} />
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        className={`help-chat-launcher${isOpen ? ' open' : ''}`}
        aria-label={isOpen ? 'Close REVORA Help' : 'Ask REVORA Help'}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        {isOpen ? <X size={21} /> : <MessageCircle size={21} />}
        {!isOpen && <span>Ask REVORA Help</span>}
      </button>
    </div>
  );
}

export default HelpChat;
