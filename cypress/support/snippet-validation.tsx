import {Auth0Context, Auth0ContextInterface} from '@auth0/auth0-react'
import {useContext, useState} from 'react'
import {createRoot} from 'react-dom/client'
import {QueryClientProvider} from 'react-query'
import {queryClient} from '../../src/App'
import {SnackbarProvider} from '../../src/contexts/snackbarProvider'
import {AddSnippetModal} from '../../src/components/snippet-table/AddSnippetModal'
import {SnippetDetail} from '../../src/screens/SnippetDetail'

// Exercise the real screens and HTTP client without an external Auth0 session.
const ValidationTest = () => {
  const auth = useContext(Auth0Context)
  const [open, setOpen] = useState(true)
  const getAccessTokenSilently = (() => Promise.resolve('test-token')) as Auth0ContextInterface['getAccessTokenSilently']
  return (
    <Auth0Context.Provider value={{...auth, isAuthenticated: true, isLoading: false, getAccessTokenSilently}}>
      <QueryClientProvider client={queryClient}>
        <SnackbarProvider>
          {new URLSearchParams(location.search).get('mode') === 'edit'
            ? <SnippetDetail id="snippet-1" handleCloseModal={() => setOpen(false)}/>
            : <>
              <button onClick={() => setOpen(true)}>Reopen</button>
              <AddSnippetModal open={open} onClose={() => setOpen(false)}/>
            </>}
        </SnackbarProvider>
      </QueryClientProvider>
    </Auth0Context.Provider>
  )
}

createRoot(document.getElementById('root')!).render(<ValidationTest/>)
