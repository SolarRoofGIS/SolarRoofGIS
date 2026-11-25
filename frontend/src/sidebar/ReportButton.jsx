import { useState } from "react";
import { FileDown, LoaderCircle } from "lucide-react";

// Downloads the estimate as a PDF. The PDF code is loaded on the first click, so the map
// does not carry it for viewers who never ask for a report.
export default function ReportButton({ getReport }) {
  const [state, setState] = useState({ status: "idle" });

  const download = async () => {
    setState({ status: "working" });
    try {
      const { downloadRoofReport } = await import("../report/roofReport");
      downloadRoofReport(getReport());
      setState({ status: "idle" });
    } catch (error) {
      setState({ status: "error", message: error.message });
    }
  };

  return (
    <div className="report-download">
      <button
        type="button"
        className="button button-outline button-compact"
        onClick={download}
        disabled={state.status === "working"}
        title="Unduh perkiraan atap ini, saran panel, dan simulasi biaya sebagai PDF"
      >
        {state.status === "working" ? <LoaderCircle size={15} className="spin" /> : <FileDown size={15} />}
        {state.status === "working" ? "Membuat PDF…" : "Unduh laporan PDF"}
      </button>
      {state.status === "error" && <p className="sidebar-error">PDF tidak dapat dibuat: {state.message}</p>}
    </div>
  );
}
