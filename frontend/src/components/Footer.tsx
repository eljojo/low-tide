import { useState, useEffect } from 'preact/hooks';
import { styled } from 'goober';
import { ThemeSwitcher } from './ThemeSwitcher';

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
  const [saying, setSaying] = useState(SAYINGS[0]);

  useEffect(() => {
    const random = SAYINGS[Math.floor(Math.random() * SAYINGS.length)];
    setSaying(random);
  }, []);

  return (
    <footer>
      <Saying title={saying.english}>
        “{saying.latin}”
      </Saying>
      <ThemeSwitcher />
    </footer>
  );
};

const Saying = styled('span')`
  font-style: italic;
  font-family: var(--font-main);
  opacity: 0.8;
`;
