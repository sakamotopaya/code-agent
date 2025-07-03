i had to kill your test command. the CLI hung and never completed. We ran into this several revisions back. Now we have completely rewritten how output adapters and really the whole path works. We need to be very careful and clear on our edits. We do not guess as to what is causing the hang and just start making code edits. We will :
1.) add logging if needed and rerun the test
2.) add test code to try and solve the issue. rerun the test
3.) if the test code fix does not correct the hang, we need to completely rollback that test code edit before trying anything else
