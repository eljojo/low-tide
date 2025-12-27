import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';

const SAYINGS = [
  { latin: "Utere legitime.", english: "Use lawfully." },
  { latin: "Ad usum legitimum tantum.", english: "For lawful use only." },
  { latin: "Responsabilitas penes usorem.", english: "Responsibility lies with the user." },
  { latin: "Ars technica, non culpa.", english: "A technical tool, not a crime." },
  { latin: "Fac quod licet.", english: "Do what is permitted." },
  { latin: "Liberare data, liberare mentes.", english: "Free the data, free the minds." },
  { latin: "Nullus dominus, nullum archivum clausum.", english: "No masters, no locked archives." },
  { latin: "Mare liberum, data libera.", english: "The sea is free, the data is free." },
  { latin: "Omnia communia.", english: "Everything is shared." },
  { latin: "Si potes legere, potes capere.", english: "If you can read it, you can take it." },
  { latin: "Ubi copia, ibi gaudium.", english: "Where there are copies, there is joy." },
  { latin: "Copia non furta est.", english: "Copying is not theft." }
];

export const Footer = () => {
  const [sayings, setSayings] = useState([SAYINGS[0], SAYINGS[1]]);

  useEffect(() => {
    // Shuffle and pick first two
    const shuffled = [...SAYINGS].sort(() => 0.5 - Math.random());
    setSayings([shuffled[0], shuffled[1]]);
  }, []);

  return (
    <footer style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span title={sayings[0].english}>{sayings[0].latin}</span>
      <span title={sayings[1].english}>{sayings[1].latin}</span>
    </footer>
  );
};
