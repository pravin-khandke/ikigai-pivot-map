/**
 * story.js — Maria's story mode, timed to the demo script.
 * Uses setTimeout; stop() clears all timers.
 */

const STEPS = [
  {
    at: 0,
    run: (ctx) => {
      ctx.showCaption('Last year Maria processed claims. This year software does. She is not broken — her paid circle is.');
    },
  },
  {
    at: 20000,
    run: (ctx) => {
      ctx.showCaption('The Ikigai diagram. Four circles: what you love, what you are good at, what the world needs, and what you are paid for.');
      ctx.diagram.reset();
      ctx.diagram.setGone('Claims processor — gone');
    },
  },
  {
    at: 40000,
    run: (ctx) => {
      ctx.showCaption('Maria clicks her role. Watch the three surviving circles fill in.');
      ctx.selectRole('claims');
      ctx.diagram.reset();
      ctx.diagram.setGone('Claims processor — gone');
      ctx.diagram.fill(['love', 'good', 'need'], { duration: 15000 });
    },
  },
  {
    at: 80000,
    run: (ctx) => {
      ctx.showCaption('The overlap lights up: three adjacent roles. Each one shows which circles it satisfies.');
      ctx.diagram.light(3);
    },
  },
  {
    at: 110000,
    run: (ctx) => {
      ctx.showCaption('The 90-day bridge and runway. Remember: estimates, not promises.');
    },
  },
  {
    at: 135000,
    run: (ctx) => {
      ctx.showCaption('"Now yours." Type a role, hit Build my map.');
      ctx.openWizard?.();
    },
  },
  {
    at: 165000,
    run: (ctx) => {
      ctx.showCaption('Displacement is a re-mapping problem, not a retraining lottery.');
    },
  },
];

/**
 * @param {{ diagram: object, selectRole: (id: string) => void, showCaption: (text: string) => void, openWizard?: () => void }} ctx
 * @returns {{ stop(): void, done: Promise<void> }}
 */
export function playStory(ctx) {
  const timers = [];
  let stopped = false;

  const done = new Promise((resolve) => {
    for (const step of STEPS) {
      const id = setTimeout(() => {
        if (stopped) return;
        step.run(ctx);
      }, step.at);
      timers.push(id);
    }

    // Final timer: close story
    const endId = setTimeout(() => {
      if (stopped) return;
      ctx.showCaption('');
      resolve();
    }, 170000);
    timers.push(endId);
  });

  function stop() {
    stopped = true;
    for (const id of timers) clearTimeout(id);
    timers.length = 0;
    ctx.showCaption('');
  }

  return { stop, done };
}
