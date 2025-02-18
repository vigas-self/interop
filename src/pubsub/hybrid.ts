/* eslint-env mocha */

import { expect } from 'aegir/chai'
import type { Daemon, DaemonFactory, NodeType, SpawnOptions } from '../index.js'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import first from 'it-first'
import { waitForSubscribed } from './utils.js'

export function hybridTests (factory: DaemonFactory): void {
  const nodeTypes: NodeType[] = ['js', 'go']

  for (const typeA of nodeTypes) {
    for (const typeB of nodeTypes) {
      runHybridTests(
        factory,
        { type: typeA, pubsub: true, pubsubRouter: 'floodsub' },
        { type: typeB, pubsub: true, pubsubRouter: 'gossipsub' }
      )
    }
  }
}

function runHybridTests (factory: DaemonFactory, optionsA: SpawnOptions, optionsB: SpawnOptions): void {
  describe('pubsub.hybrid', () => {
    let daemonA: Daemon
    let daemonB: Daemon

    // Start Daemons
    before(async function () {
      this.timeout(20 * 1000)

      daemonA = await factory.spawn(optionsA)
      daemonB = await factory.spawn(optionsB)

      const identifyB = await daemonB.client.identify()
      await daemonA.client.connect(identifyB.peerId, identifyB.addrs)
    })

    // Stop daemons
    after(async function () {
      await Promise.all(
        [daemonA, daemonB]
          .filter(Boolean)
          .map(async d => { await d.stop() })
      )
    })

    it(`${optionsA.type} peer to ${optionsB.type} peer`, async function () {
      const topic = 'test-topic'
      const data = uint8ArrayFromString('test-data')

      const subscription = await daemonB.client.pubsub.subscribe(topic)
      const subscriber = async (): Promise<void> => {
        const message = await first(subscription.messages())

        expect(message).to.exist()
        expect(message).to.have.property('data').that.equalBytes(data)
      }

      const publisher = async (): Promise<void> => {
        await waitForSubscribed(topic, daemonA, daemonB)
        await daemonA.client.pubsub.publish(topic, data)
      }

      return await Promise.all([
        subscriber(),
        publisher()
      ])
    })
  })
}
