import {Alert, OutlinedInput} from "@mui/material";
import {Bòx} from "../components/snippet-table/SnippetBox.tsx";
import {useState} from "react";
import {useSnippetRun} from "../hooks/useSnippetRun.ts";

type SnippetExecutionProps = {
  snippetId: string;
  running: boolean;
  onFinished: () => void;
}

export const SnippetExecution = ({snippetId, running, onFinished}: SnippetExecutionProps) => {
  const [input, setInput] = useState<string>("")
  const {lines, pendingInput, error, sendInput} = useSnippetRun(snippetId, running, onFinished)

  const handleEnter = (event: { key: string }) => {
    if (event.key === 'Enter' && pendingInput) {
      sendInput(input)
      setInput("")
    }
  };

  return (
    <>
      <Bòx data-testid="execution-output" flex={1} overflow={"auto"} minHeight={200} bgcolor={'black'} color={'white'}
           code={lines.join("\n")}>
        <pre style={{margin: 0, padding: 10, fontFamily: "monospace", fontSize: 17, whiteSpace: "pre-wrap"}}>
          {lines.join("\n")}
        </pre>
      </Bòx>
      {error && <Alert severity="error">{error}</Alert>}
      <OutlinedInput onKeyDown={handleEnter} value={input} onChange={e => setInput(e.target.value)}
                     placeholder="Type here" disabled={!pendingInput} inputProps={{'data-testid': 'execution-input'}} fullWidth/>
    </>
  )
}
