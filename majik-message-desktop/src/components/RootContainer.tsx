import styled from "styled-components";
import type { ReactNode, JSX } from "react";

const Root = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
`;

export default function RootContainer({
  children,
}: {
  children?: ReactNode;
}): JSX.Element {
  return <Root>{children}</Root>;
}
