import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const terms = [
  {
    title: 'Ledger',
    desc: 'A record of all financial transactions.',
    img: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=400&q=80',
  },
  {
    title: 'Invoice',
    desc: 'A document requesting payment for goods or services.',
    img: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80',
  },
  {
    title: 'Balance Sheet',
    desc: 'A statement of assets, liabilities, and equity.',
    img: 'https://images.unsplash.com/photo-1464983953574-0892a716854b?auto=format&fit=crop&w=400&q=80',
  },
  {
    title: 'Cash Flow',
    desc: 'The movement of money in and out of a business.',
    img: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=400&q=80',
  },
];

const slides = [
  {
    img: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=800&q=80',
    caption: 'Track your ledgers with ease',
  },
  {
    img: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80',
    caption: 'Generate invoices in seconds',
  },
  {
    img: 'https://images.unsplash.com/photo-1464983953574-0892a716854b?auto=format&fit=crop&w=800&q=80',
    caption: 'Visualize your balance sheets',
  },
  {
    img: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=800&q=80',
    caption: 'Monitor your cash flow anywhere',
  },
];

function Home() {
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setCurrent(c => (c + 1) % slides.length), 4000);
    return () => clearInterval(timer);
  }, []);
  const prevSlide = () => setCurrent(c => (c - 1 + slides.length) % slides.length);
  const nextSlide = () => setCurrent(c => (c + 1) % slides.length);

  return (
    <div className="home-container">
      <div className="carousel">
        <button className="carousel-btn left" onClick={prevSlide} aria-label="Previous slide">&#8592;</button>
        <img src={slides[current].img} alt={slides[current].caption} className="carousel-img" />
        <div className="carousel-caption">{slides[current].caption}</div>
        <button className="carousel-btn right" onClick={nextSlide} aria-label="Next slide">&#8594;</button>
        <div className="carousel-dots">
          {slides.map((_, i) => (
            <span key={i} className={i === current ? 'active' : ''} onClick={() => setCurrent(i)}></span>
          ))}
        </div>
      </div>
      <h3 style={{marginTop: 32}}>Key Accounting Terms</h3>
      <div className="terms-grid">
        {terms.map(term => (
          <div className="term-card" key={term.title}>
            <img src={term.img} alt={term.title} className="term-img" />
            <h4>{term.title}</h4>
            <p>{term.desc}</p>
          </div>
        ))}
      </div>
      <style>{`
        .home-container {
          max-width: 900px;
          margin: 0 auto;
          padding: 24px;
        }
        .home-nav ul {
          display: flex;
          gap: 24px;
          list-style: none;
          padding: 0;
          justify-content: center;
        }
        .terms-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 24px;
          margin-top: 24px;
        }
        .term-card {
          background: #fff;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.07);
          padding: 16px;
          text-align: center;
          transition: transform 0.2s;
        }
        .term-card:hover {
          transform: translateY(-4px) scale(1.03);
        }
        .term-img {
          width: 100%;
          max-width: 120px;
          height: 80px;
          object-fit: cover;
          border-radius: 8px;
          margin-bottom: 12px;
        }
        .carousel {
          position: relative;
          max-width: 700px;
          margin: 0 auto 32px auto;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f7f7f7;
          border-radius: 16px;
          overflow: hidden;
          min-height: 220px;
        }
        .carousel-img {
          width: 100%;
          max-width: 700px;
          height: 220px;
          object-fit: cover;
        }
        .carousel-caption {
          position: absolute;
          bottom: 16px;
          left: 0;
          right: 0;
          text-align: center;
          color: #fff;
          background: rgba(0,0,0,0.4);
          font-size: 1.2rem;
          padding: 8px 0;
          border-radius: 0 0 16px 16px;
        }
        .carousel-btn {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          background: rgba(44,62,80,0.7);
          color: #fff;
          border: none;
          font-size: 2rem;
          padding: 0 12px;
          cursor: pointer;
          z-index: 2;
          border-radius: 50%;
        }
        .carousel-btn.left { left: 8px; }
        .carousel-btn.right { right: 8px; }
        .carousel-dots {
          position: absolute;
          bottom: 8px;
          left: 0;
          right: 0;
          text-align: center;
        }
        .carousel-dots span {
          display: inline-block;
          width: 10px;
          height: 10px;
          margin: 0 3px;
          background: #fff;
          border-radius: 50%;
          opacity: 0.5;
          cursor: pointer;
        }
        .carousel-dots .active {
          opacity: 1;
          background: #ffd700;
        }
        @media (max-width: 700px) {
          .carousel-img { height: 140px; }
          .carousel { min-height: 140px; }
        }
        @media (max-width: 600px) {
          .home-container { padding: 8px; }
          .terms-grid { gap: 12px; }
          .term-card { padding: 10px; }
          .home-nav ul { gap: 12px; font-size: 15px; }
        }
      `}</style>
    </div>
  );
}

export default Home;
