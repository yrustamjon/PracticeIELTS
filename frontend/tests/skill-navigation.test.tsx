import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it } from "vitest";
import { SkillNavigation } from "../src/components/SkillNavigation";
it("separates Listening audio tasks and Reading passages with distinct destinations and selected skill", () => {
  render(
    <MemoryRouter>
      <SkillNavigation active="reading" />
    </MemoryRouter>,
  );
  const nav = screen.getByRole("navigation", {
    name: "Choose Listening or Reading",
  });
  const listening = within(nav).getByRole("link", {
    name: /Listening.*Audio practice/,
  });
  const reading = within(nav).getByRole("link", { name: /Reading.*Passages/ });
  expect(listening).toHaveAttribute("href", "/library");
  expect(reading).toHaveAttribute("href", "/reading");
  expect(reading).toHaveAttribute("aria-current", "true");
  expect(listening).not.toHaveAttribute("aria-current");
});
