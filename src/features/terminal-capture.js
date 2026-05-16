/**
 * Feature 2: Terminal Output Capture
 *
 * Enhances run_command to capture terminal output and feed it back
 * to the agent as context for follow-up analysis.
 */
const TerminalCapture = {
  _lastOutput: "",
  _lastCommand: "",
  _lastExitCode: null,
  _maxOutputChars: 8000,
  _captureEnabled: true,

  lastCapture() {
    return {
      command: this._lastCommand,
      output: this._lastOutput,
      exitCode: this._lastExitCode,
      time: this._lastTime || "",
      truncated: this._truncated || false,
    };
  },

  contextForAgent() {
    if (!this._lastCommand || !this._lastOutput) return "";
    const exit = this._lastExitCode !== null ? ` (exit ${this._lastExitCode})` : "";
    const trunc = this._truncated ? " [output truncated]" : "";
    return [
      "Last terminal command" + exit + trunc + ":",
      "$ " + this._lastCommand,
      "```",
      this._lastOutput.slice(0, this._maxOutputChars),
      "```",
    ].join("\n");
  },

  async runAndCapture(command, options) {
    const cmd = AgentTools.safeCommand(command);
    if (!cmd) {
      throw ErrorKit.create({
        code: "COMMAND_BLOCKED",
        title: "Command blocked",
        message: "Command blocked by Ace AI safety policy: " + (command || "(empty)"),
        hint: "Only safe lint/test/check commands are allowed.",
      });
    }

    this._lastCommand = cmd;
    this._lastOutput = "";
    this._lastExitCode = null;
    this._lastTime = new Date().toISOString();
    this._truncated = false;

    // Try to use Acode terminal with output capture
    try {
      // Acode's terminal API may provide output capture via callback
      const terminal = Acode.require("terminal");
      if (terminal && typeof terminal.run === "function") {
        const result = await terminal.run(cmd, {
          name: options?.name || "Ace AI",
          capture: true,
        });
        if (result && typeof result === "object") {
          this._lastOutput = String(result.output || result.stdout || "").slice(
            0,
            this._maxOutputChars * 2,
          );
          this._lastExitCode = result.exitCode ?? result.code ?? null;
          if (this._lastOutput.length > this._maxOutputChars) {
            this._lastOutput = this._lastOutput.slice(0, this._maxOutputChars);
            this._truncated = true;
          }
          return this.lastCapture();
        }
      }
    } catch (_) {}

    // Fallback: run visible terminal and capture what we can
    try {
      await Acode.runVisibleTerminal(cmd, { name: options?.name || "Ace AI Run" });
      // Visible terminal doesn't return output directly, but we mark as executed
      this._lastOutput = "(output captured in visible terminal tab)";
      this._lastExitCode = null;
    } catch (error) {
      this._lastOutput = "Error: " + (error.message || String(error));
      this._lastExitCode = 1;
    }

    State.terminalHistory.unshift({
      command: cmd,
      output: this._lastOutput.slice(0, 500),
      exitCode: this._lastExitCode,
      time: this._lastTime,
    });
    State.terminalHistory = State.terminalHistory.slice(0, 10);

    return this.lastCapture();
  },
};
