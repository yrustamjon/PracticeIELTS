import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import { Empty } from "../src/components/ui";
import { ComparisonView } from "../src/features/Practice";
describe("Learning feedback", () => {
  it("labels comparison statuses without relying on color", () => {
    render(
      <ComparisonView
        result={{
          accuracy: 50,
          reference: "our library",
          tokens: [
            {
              status: "incorrect",
              actual: "the",
              expected: "our",
              reason: "word",
            },
            {
              status: "missing",
              actual: "",
              expected: "library",
              reason: "missing",
            },
          ],
        }}
      />,
    );
    expect(screen.getByText("incorrect")).toBeInTheDocument();
    expect(screen.getByText("missing")).toBeInTheDocument();
    expect(screen.getByText("50% accuracy")).toBeInTheDocument();
  });
  it("provides a meaningful empty state", () => {
    render(
      <BrowserRouter>
        <Empty
          title="No materials yet"
          description="Publish your first listening material."
        />
      </BrowserRouter>,
    );
    expect(
      screen.getByRole("heading", { name: "No materials yet" }),
    ).toBeInTheDocument();
  });
});
