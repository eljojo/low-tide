import { styled } from 'goober';

export const Header = () => {
  return (
    <header>
      <BrandLink href="/">
        <Title>Low Tide</Title>
      </BrandLink>
    </header>
  );
};

const BrandLink = styled('a')`
  text-decoration: none;
  color: inherit;
  cursor: pointer;
`;

const Title = styled('h1')`
  font-size: 1.2rem;
  margin: 0;
  font-weight: 800;
  letter-spacing: -0.03em;
`;
