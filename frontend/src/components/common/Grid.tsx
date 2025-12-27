import { styled } from 'goober';

export const GridContainer = styled('div')`
  display: grid;
  grid-template-rows: auto 1fr;
  height: 100%;
  overflow: hidden;
`;

export const GridHeader = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

export const GridScrollArea = styled('div')`
  max-height: 70vh;
  overflow-y: auto;
  padding-right: 0.5rem;

  &::-webkit-scrollbar {
    width: 6px;
    background: rgba(0,0,0,0.05);
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(0,0,0,0.2);
    border-radius: 3px;
  }
`;
