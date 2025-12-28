import { styled } from 'goober';

export const Item = styled('div')<{ selected?: boolean }>`
  padding: 1rem 1.25rem;
  border-radius: var(--border-radius);
  border: 1px solid ${props => props.selected ? 'var(--accent2)' : 'transparent'};
  margin-bottom: 0.75rem;
  cursor: pointer;
  transition: all 0.2s ease;
  background: ${props => props.selected ? 'var(--card-bg)' : 'rgba(0,0,0,0.015)'};
  ${props => props.selected && 'box-shadow: 0 8px 24px rgba(0,0,0,0.04);'}

  &:hover {
    background: ${props => props.selected ? 'var(--card-bg)' : 'rgba(0,0,0,0.035)'};
  }
`;
