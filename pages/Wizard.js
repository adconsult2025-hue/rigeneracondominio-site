import { useState } from "react";

export default function Wizard() {
  const [step, setStep] = useState("start");
  return <div>Wizard Component</div>;
}