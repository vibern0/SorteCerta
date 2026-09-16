export class TransactionSender {
  #simulate;
  #send;
  #receipts = new Map();
  #signerQueues = new Map();

  constructor({ simulate, send }) {
    this.#simulate = simulate;
    this.#send = send;
  }

  async send(request) {
    if (this.#receipts.has(request.idempotencyKey)) {
      return this.#receipts.get(request.idempotencyKey);
    }

    const previous = this.#signerQueues.get(request.signer) ?? Promise.resolve();
    const next = previous.then(async () => {
      if (this.#receipts.has(request.idempotencyKey)) {
        return this.#receipts.get(request.idempotencyKey);
      }

      await this.#simulate(request);
      const receipt = await this.#send(request);
      this.#receipts.set(request.idempotencyKey, receipt);
      return receipt;
    });

    this.#signerQueues.set(request.signer, next.catch(() => undefined));
    return next;
  }
}
