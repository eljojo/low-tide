import { styled } from 'goober';

export const TableContainer = styled('div')`
  overflow: hidden;
  background: var(--input-bg);
  border-radius: var(--border-radius);
  border: 1px solid var(--border-color);
`;

export const TableRow = styled('div')<{ isHeader?: boolean; columns?: string }>`
  display: grid;
  grid-template-columns: ${props => props.columns || '1fr 120px 100px'};
  align-items: center;
  padding: ${props => props.isHeader ? '0.8rem 1.25rem' : '0.9rem 1.25rem'};
  font-size: ${props => props.isHeader ? '0.7rem' : '0.9rem'};
  text-transform: ${props => props.isHeader ? 'uppercase' : 'none'};
  font-weight: ${props => props.isHeader ? '800' : 'normal'};
  color: ${props => props.isHeader ? 'var(--muted)' : 'inherit'};
  background: ${props => props.isHeader ? 'rgba(0,0,0,0.02)' : 'transparent'};
  border-bottom: 1px solid var(--border-color);
  transition: background-color 0.2s;

  ${props => !props.isHeader && `
    &:hover { background: rgba(0,0,0,0.02); }
    &:last-child { border-bottom: none; }
  `}
`;

export const TableScrollArea = styled('div')`
  max-height: 320px;
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 6px;
    background: rgba(0,0,0,0.05);
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(0,0,0,0.2);
    border-radius: 3px;
  }
`;

export const TableFooter = styled('div')`
  padding: 1rem 1.25rem;
  background: rgba(0,0,0,0.02);
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: flex-end;
`;
