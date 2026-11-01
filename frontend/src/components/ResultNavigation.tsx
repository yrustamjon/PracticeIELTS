import { Fragment } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ChevronRight } from "lucide-react";
import "./resultNavigation.css";

type Step = { label: string; to?: string };
export function ResultNavigation({ steps, back }: { steps: Step[]; back: { label: string; to: string } }) {
  return <div className="result-navigation">
    <nav aria-label="Location" className="result-breadcrumbs">
      {steps.map((step, index) => <Fragment key={`${index}-${step.label}`}>
        {index > 0 && <ChevronRight size={13} aria-hidden="true" />}
        {step.to ? <Link to={step.to}>{step.label}</Link> : <span aria-current={index === steps.length - 1 ? "page" : undefined}>{step.label}</span>}
      </Fragment>)}
    </nav>
    <Link className="result-back" to={back.to}><ArrowLeft size={15} aria-hidden="true" />{back.label}</Link>
  </div>;
}
