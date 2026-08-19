import { Estimate, MavrykToolkit } from '@mavrykdynamics/webmavryk';
import { localForger } from '@mavrykdynamics/webmavryk-local-forging';
import { ForgeOperationsParams } from '@mavrykdynamics/webmavryk-rpc';
import { z } from 'zod';

import { formatOpParamsBeforeSend, michelEncoder, loadFastRpcClient, isAddressValid } from 'lib/temple/helpers';
import { ReadOnlySigner } from 'lib/temple/read-only-signer';

const NON_NEGATIVE_INTEGER_PATTERN = /^(0|[1-9]\d*)$/;

const nonNegativeIntegerLikeSchema = z.union([
  z.number().int().nonnegative().finite(),
  z.string().regex(NON_NEGATIVE_INTEGER_PATTERN)
]);

const mavrykAddressSchema = z.string().refine(isAddressValid, { message: 'Invalid Mavryk address' });
const optionalMavrykAddressSchema = mavrykAddressSchema.optional();
const requiredUnknownSchema = z.unknown().refine(value => value !== undefined, { message: 'Required' });

const operationBaseFields = {
  source: optionalMavrykAddressSchema,
  fee: nonNegativeIntegerLikeSchema.optional(),
  gasLimit: nonNegativeIntegerLikeSchema.optional(),
  storageLimit: nonNegativeIntegerLikeSchema.optional()
};

const transactionSchema = z
  .object({
    kind: z.literal('transaction'),
    to: optionalMavrykAddressSchema,
    destination: optionalMavrykAddressSchema,
    amount: nonNegativeIntegerLikeSchema,
    parameter: z.unknown().optional(),
    parameters: z.unknown().optional(),
    mumav: z.boolean().optional(),
    mutez: z.boolean().optional(),
    ...operationBaseFields
  })
  .passthrough()
  .superRefine((op, ctx) => {
    if (!op.to && !op.destination) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Transaction operation requires a destination address',
        path: ['to']
      });
    }
  });

const delegationSchema = z
  .object({
    kind: z.literal('delegation'),
    delegate: optionalMavrykAddressSchema,
    ...operationBaseFields
  })
  .passthrough();

const revealSchema = z
  .object({
    kind: z.literal('reveal'),
    publicKey: z.string().min(1).optional(),
    public_key: z.string().min(1).optional(),
    ...operationBaseFields
  })
  .passthrough();

const originationSchema = z
  .object({
    kind: z.literal('origination'),
    balance: nonNegativeIntegerLikeSchema.optional(),
    delegate: optionalMavrykAddressSchema,
    script: requiredUnknownSchema.optional(),
    code: requiredUnknownSchema.optional(),
    storage: requiredUnknownSchema.optional(),
    init: requiredUnknownSchema.optional(),
    mumav: z.boolean().optional(),
    mutez: z.boolean().optional(),
    ...operationBaseFields
  })
  .passthrough()
  .superRefine((op, ctx) => {
    const hasScript = op.script !== undefined;
    const hasCodeAndStorage = op.code !== undefined && (op.storage !== undefined || op.init !== undefined);

    if (!hasScript && !hasCodeAndStorage) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Origination operation requires script or code with storage/init',
        path: ['script']
      });
    }
  });

const stakeSchema = z
  .object({
    kind: z.literal('stake'),
    to: optionalMavrykAddressSchema,
    amount: nonNegativeIntegerLikeSchema,
    parameter: z.unknown().optional(),
    mumav: z.boolean().optional(),
    mutez: z.boolean().optional(),
    ...operationBaseFields
  })
  .passthrough();

const unstakeSchema = z
  .object({
    kind: z.literal('unstake'),
    to: optionalMavrykAddressSchema,
    amount: nonNegativeIntegerLikeSchema,
    parameter: z.unknown().optional(),
    mumav: z.boolean().optional(),
    mutez: z.boolean().optional(),
    ...operationBaseFields
  })
  .passthrough();

const finalizeUnstakeSchema = z
  .object({
    kind: z.literal('finalize_unstake'),
    to: optionalMavrykAddressSchema,
    amount: nonNegativeIntegerLikeSchema.optional(),
    parameter: z.unknown().optional(),
    mumav: z.boolean().optional(),
    mutez: z.boolean().optional(),
    ...operationBaseFields
  })
  .passthrough();

const increasePaidStorageSchema = z
  .object({
    kind: z.literal('increase_paid_storage'),
    amount: nonNegativeIntegerLikeSchema,
    destination: mavrykAddressSchema,
    ...operationBaseFields
  })
  .passthrough();

const activationSchema = z
  .object({
    kind: z.literal('activation'),
    pkh: mavrykAddressSchema,
    secret: z.string().min(1)
  })
  .passthrough();

const registerGlobalConstantSchema = z
  .object({
    kind: z.literal('register_global_constant'),
    value: requiredUnknownSchema,
    ...operationBaseFields
  })
  .passthrough();

const transferTicketSchema = z
  .object({
    kind: z.literal('transfer_ticket'),
    ticketContents: requiredUnknownSchema,
    ticketTy: requiredUnknownSchema,
    ticketTicketer: mavrykAddressSchema,
    ticketAmount: nonNegativeIntegerLikeSchema,
    destination: mavrykAddressSchema,
    entrypoint: z.string().min(1),
    ...operationBaseFields
  })
  .passthrough();

const updateConsensusKeySchema = z
  .object({
    kind: z.literal('update_consensus_key'),
    pk: z.string().min(1),
    ...operationBaseFields
  })
  .passthrough();

const smartRollupAddMessagesSchema = z
  .object({
    kind: z.literal('smart_rollup_add_messages'),
    message: z.array(z.string())
  })
  .merge(z.object(operationBaseFields))
  .passthrough();

const smartRollupOriginateSchema = z
  .object({
    kind: z.literal('smart_rollup_originate'),
    pvmKind: z.string().min(1),
    kernel: z.string().min(1),
    parametersType: requiredUnknownSchema,
    ...operationBaseFields
  })
  .passthrough();

const smartRollupExecuteOutboxMessageSchema = z
  .object({
    kind: z.literal('smart_rollup_execute_outbox_message'),
    rollup: z.string().min(1),
    cementedCommitment: z.string().min(1),
    outputProof: z.string().min(1),
    ...operationBaseFields
  })
  .passthrough();

const failingNoopSchema = z
  .object({
    kind: z.literal('failing_noop'),
    arbitrary: z.string().min(1)
  })
  .passthrough();

const opParamSchema = z.union([
  transactionSchema,
  delegationSchema,
  revealSchema,
  originationSchema,
  stakeSchema,
  unstakeSchema,
  finalizeUnstakeSchema,
  increasePaidStorageSchema,
  activationSchema,
  registerGlobalConstantSchema,
  transferTicketSchema,
  updateConsensusKeySchema,
  smartRollupAddMessagesSchema,
  smartRollupOriginateSchema,
  smartRollupExecuteOutboxMessageSchema,
  failingNoopSchema
]);

const opParamsSchema = z.array(opParamSchema).nonempty();

export function validateOpParams(opParams: unknown): asserts opParams is any[] {
  const result = opParamsSchema.safeParse(opParams);

  if (!result.success) {
    throw new Error('Invalid operation parameters');
  }
}

const validateOptionalOverride = (value: unknown, fieldName: string) => {
  if (value === undefined) return;

  if (!nonNegativeIntegerLikeSchema.safeParse(value).success) {
    throw new Error(`Invalid ${fieldName} override`);
  }
};

type DryRunParams = {
  opParams: any[];
  networkRpc: string;
  sourcePkh: string;
  sourcePublicKey: string;
};

export interface DryRunResult {
  error?: Array<any>;
  result?: {
    bytesToSign?: string;
    rawToSign: ForgeOperationsParams;
    estimates: Array<Estimate>;
    opParams: any;
  };
}

const FEE_PER_GAS_UNIT = 0.1;

export async function dryRunOpParams({
  opParams,
  networkRpc,
  sourcePkh,
  sourcePublicKey
}: DryRunParams): Promise<DryRunResult | null> {
  try {
    validateOpParams(opParams);

    const tezos = new MavrykToolkit(loadFastRpcClient(networkRpc));

    let bytesToSign: string | undefined;
    const signer = new ReadOnlySigner(sourcePkh, sourcePublicKey, digest => {
      bytesToSign = digest;
    });

    tezos.setSignerProvider(signer);
    tezos.setPackerProvider(michelEncoder);

    let estimates: Estimate[] | undefined;
    let error: any = [];
    try {
      const formatted = opParams.map(formatOpParamsBeforeSend);
      const result = [
        await tezos.estimate.batch(formatted).catch(e => ({ ...e, isError: true })),
        await tezos.contract
          .batch(formatted)
          .send()
          .catch(e => ({ ...e, isError: true }))
      ];
      if (result.every(x => x.isError)) {
        error = result;
      }
      estimates = result[0]?.map(
        (e: any, i: number) =>
          ({
            ...e,
            burnFeeMumav: e.burnFeeMumav,
            consumedMilligas: e.consumedMilligas,
            gasLimit: e.gasLimit,
            minimalFeeMumav: e.minimalFeeMumav,
            storageLimit: opParams[i]?.storageLimit ? +opParams[i].storageLimit : e.storageLimit,
            suggestedFeeMumav:
              e.suggestedFeeMumav +
              (opParams[i]?.gasLimit ? Math.ceil((opParams[i].gasLimit - e.gasLimit) * FEE_PER_GAS_UNIT) : 0),
            totalCost: e.totalCost,
            usingBaseFeeMumav: e.usingBaseFeeMumav
          } as Estimate)
      );
    } catch {}

    if (bytesToSign && estimates) {
      const withReveal = estimates.length === opParams.length + 1;
      const rawToSign = await localForger.parse(bytesToSign);
      return {
        result: {
          bytesToSign,
          rawToSign,
          estimates,
          opParams: opParams.map((op, i) => {
            const eIndex = withReveal ? i + 1 : i;
            return {
              ...op,
              fee: op.fee ?? estimates?.[eIndex].suggestedFeeMumav,
              gasLimit: op.gasLimit ?? estimates?.[eIndex].gasLimit,
              storageLimit: op.storageLimit ?? estimates?.[eIndex].storageLimit
            };
          })
        }
      };
    }

    return error.length ? { error } : null;
  } catch (e) {
    return { error: [e] };
  }
}

export function buildFinalOpParmas(opParams: any[], modifiedTotalFee?: number, modifiedStorageLimit?: number) {
  validateOptionalOverride(modifiedTotalFee, 'fee');
  validateOptionalOverride(modifiedStorageLimit, 'storage limit');

  let result = opParams;

  if (modifiedTotalFee !== undefined) {
    result = result.map((op, index) => ({ ...op, fee: index === 0 ? modifiedTotalFee : 0 }));
  }

  if (modifiedStorageLimit !== undefined && result.length < 2) {
    result = result.map((op, index) => (index === 0 ? { ...op, storageLimit: modifiedStorageLimit } : op));
  }

  return result;
}
