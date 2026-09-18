# Scribble Relay

A pass-the-device drawing party game for 3 to 12 players. Think Chinese whispers
with drawings.

**Play it:** https://juslangit.github.io/scribble-relay/

## How it plays

1. The first player secretly **writes** a phrase, like *"a cat robbing a bank"*.
2. The next player sees only that phrase and **draws** it before the timer runs out.
3. The next player sees only the drawing and **guesses** what it is.
4. It keeps alternating (draw, guess, draw, guess) until everyone has had a turn.
5. Everyone gathers round for the **reveal**: the whole chain plays back one step
   at a time, so you can see exactly where it went wrong. Crown the funniest turn,
   then save the whole chain as one image to share.

## Works on

Phones, tablets and computers, in portrait or landscape. Draw with a finger, a
stylus or a mouse. On a phone, the keyboard never covers the guess box, and the
screen stays awake during a game.

## Tech

The game is plain HTML, CSS and JavaScript in `index.html`, with no server and no
build step. Its screens, text boxes and drawing pad are ordinary web page parts,
because that is what makes typing and finger-drawing feel right.

On top of that sits an **effects layer** (`fx.js`), drawn by
[Phaser](https://phaser.io) 4 on a see-through canvas over the page: confetti
when the chain is finished and at the end of the reveal, stars in the next
player's colour when a turn is handed over, a red flash when time runs out, and
real sound effects from Kenney's free CC0 packs (`sounds.js`, rebuilt by
`tools/build_sounds.py`). It never takes a tap, it is asleep and hidden while
you draw or type, and if Phaser fails to load the game plays on with its
original built-in beeps. Phaser is kept in `vendor/`, so nothing is fetched from
the internet.

Open `index.html` in a browser to play locally.

## Tests

```bash
./test/run.sh
```

Plays a full 4-player game in headless Chrome at phone, phone-landscape, tablet
and desktop sizes, drawing with real touch and mouse input. It checks turn order,
undo, the timer auto-submitting, the reveal, the saved chain image, and that no
screen scrolls sideways. Then it checks the effects layer twice, once with
Phaser's Canvas renderer and once with WebGL: that it never blocks a tap, stays
asleep the whole time someone draws, goes back to sleep after every effect,
honours the phone's reduce-motion setting, and that the game still plays with
Phaser missing. Needs Node and Google Chrome.
