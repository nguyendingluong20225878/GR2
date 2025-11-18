import { HydratedDocument, InferSchemaType, Schema, model, models } from "mongoose";
import { z } from "zod";

const contractCallSchema = z.object({
  type: z.string(),
  description: z.string(),
  params: z.object({
    fromToken: z.object({
      symbol: z.string(),
      address: z.string(),
    }),
    toToken: z.object({
      symbol: z.string(),
      address: z.string(),
    }),
    fromAmount: z.number(),
  }),
  metadata: z.record(z.unknown()).optional(),
});

const financialImpactSchema = {
  currentValue: Number,
  projectedValue: Number,
  percentChange: Number,
  timeFrame: String,
  riskLevel: { type: String, enum: ["low", "medium", "high"] },
  simulationResults: {
    success: Boolean,
    tokenBalances: Schema.Types.Mixed,
    positions: Schema.Types.Mixed,
  },
};

const proposalSchema = new Schema(
  {
    triggerEventId: { type: String },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true },
    summary: { type: String, required: true },
    reason: { type: [String], required: true },
    sources: {
      type: [
        {
          name: { type: String, required: true },
          url: { type: String, required: true },
        },
      ],
      required: true,
    },
    type: { type: String },
    proposedBy: { type: String },
    financialImpact: { type: financialImpactSchema, required: false },
    expiresAt: { type: Date, required: true },
    status: { type: String, default: "active" },
    contractCall: { type: Schema.Types.Mixed },
  },
  {
    collection: "proposals",
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
  },
);

proposalSchema.index({ userId: 1, status: 1 });
proposalSchema.index({ expiresAt: 1 });

export type ContractCall = z.infer<typeof contractCallSchema>;

export type ProposalSchema = InferSchemaType<typeof proposalSchema>;
export type ProposalDocument = HydratedDocument<ProposalSchema>;
export type ProposalSelect = ProposalDocument;
export type ProposalInsert = ProposalSchema;

export const proposalTable = models.Proposal ?? model<ProposalSchema>("Proposal", proposalSchema);

export const validateContractCall = (data: unknown): ContractCall => contractCallSchema.parse(data);
