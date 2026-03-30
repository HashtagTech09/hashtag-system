import type { FeeBreakdown as FeeBreakdownType } from "@/lib/enrollmentUtils";

interface FeeBreakdownProps {
  breakdown: FeeBreakdownType;
  regularCycles: number;
  gridCycles: number;
  detectedStatus: string;
}

export default function FeeBreakdownDisplay({ breakdown, regularCycles, gridCycles, detectedStatus }: FeeBreakdownProps) {
  return (
    <div className="p-3 rounded-lg border border-border bg-muted/30 text-sm space-y-1">
      <p className="font-medium text-foreground mb-2">Fee Breakdown</p>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Per batch ({regularCycles}R × ₹3,767 + {gridCycles}G × ₹5,300)</span>
        <span>₹{breakdown.perBatchFee.toLocaleString()}</span>
      </div>

      {/* Per-batch line items with hierarchy */}
      {breakdown.batchAllocations.length > 0 && (
        <div className="pl-2 border-l-2 border-primary/20 ml-1 space-y-0.5">
          {breakdown.batchAllocations.map((alloc, idx) => (
            <div key={idx} className="flex justify-between text-xs">
              <span className={alloc.is_primary ? "text-foreground font-medium" : "text-muted-foreground"}>
                {alloc.batch_name} {alloc.is_primary ? "(Primary)" : `(${Math.round(breakdown.discountPct * 100)}% off)`}
              </span>
              <span className={alloc.is_primary ? "" : "text-success"}>₹{alloc.amount.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}

      {breakdown.discountPct > 0 && (
        <div className="flex justify-between text-success">
          <span>Multi-batch discount ({breakdown.batchCount} batches)</span>
          <span>-₹{breakdown.discountAmount.toLocaleString()}</span>
        </div>
      )}
      <div className="flex justify-between">
        <span className="text-muted-foreground">Batch total ({breakdown.batchCount} batch{breakdown.batchCount > 1 ? "es" : ""})</span>
        <span>₹{breakdown.totalBatchFee.toLocaleString()}</span>
      </div>
      {breakdown.regFee > 0 && (
        <div className="flex justify-between">
          <span className="text-muted-foreground">Registration fee ({detectedStatus}{breakdown.isLateRenewal ? " - Late" : ""})</span>
          <span>₹{breakdown.regFee}</span>
        </div>
      )}
      {breakdown.dropInAdj > 0 && (
        <div className="flex justify-between text-success">
          <span>Drop-in adjustment</span>
          <span>-₹{breakdown.dropInAdj.toLocaleString()}</span>
        </div>
      )}
      <div className="flex justify-between border-t border-border pt-1 mt-1">
        <span className="text-muted-foreground">Subtotal</span>
        <span>₹{breakdown.subtotal.toLocaleString()}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">GST (18%)</span>
        <span>₹{breakdown.gst.toLocaleString()}</span>
      </div>
      <div className="flex justify-between font-semibold border-t border-border pt-1 mt-1">
        <span>Total</span>
        <span>₹{breakdown.total.toLocaleString()}</span>
      </div>
    </div>
  );
}
