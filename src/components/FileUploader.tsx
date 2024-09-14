"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Box, Button, Heading, VStack, Text, Spinner } from "@chakra-ui/react";
import DocumentInformation from "./DocumentInformation";
import ViewDoc from "./ViewDoc";

const FileUploader: React.FC = () => {
  const [textractResults, setTextractResults] = useState<string | null>(null);
  const [loadingTextractResults, setLoadingTextractResults] =
    useState<boolean>(false);
  const [textractResultsUrl, setTextractResultsUrl] = useState<string | null>(
    null
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentInformation, setDocumentInformation] = useState<{
    score?: number;
    summaryPoints?: string[];
    sketchyClauses?: string[];
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file.size > 150 * 1024) {
      setErrorMessage("File size exceeds 150KB. Please upload a smaller file.");
      setSelectedFile(null);
    } else {
      setErrorMessage(null);
      setSelectedFile(file);
    }
  }, []);

  const handleUpload = async () => {
    if (!selectedFile) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64data = reader.result?.toString().split(",")[1];

      const response = await fetch("/api/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          file: {
            name: selectedFile.name,
            type: selectedFile.type,
            data: base64data,
          },
        }),
      });

      const result = await response.json();
      setLoadingTextractResults(true);
      setTextractResultsUrl(result?.url + "-results.json");
    };

    reader.readAsDataURL(selectedFile);
  };

  useEffect(() => {
    if (!loadingTextractResults || !textractResultsUrl || textractResults)
      return;

    let timerId: number | null;

    const pollResults = () => {
      fetch(textractResultsUrl)
        .then((response) => response.json())
        .then((data) => {
          if (data.text && data.text.length > 0) {
            setTextractResults(data.text.join(" "));
          } else {
            timerId = setTimeout(pollResults, 5000) as unknown as number;
          }
        })
        .catch((error) => {
          console.error("Error fetching results:", error);
          timerId = setTimeout(pollResults, 5000) as unknown as number;
        });
    };

    pollResults();

    return () => {
      // Clean up any pending timeouts when the component unmounts
      if (timerId) {
        clearTimeout(timerId);
      }
    };
  }, [loadingTextractResults, textractResultsUrl, textractResults]);

  useEffect(() => {
    if (!textractResults) return;

    const fetchDocumentData = async () => {
      try {
        const response = await fetch("/api/getDocumentData", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text: textractResults }),
        });

        const data = await response.json();
        const cleanedContent = data.choices[0].message.content
          .replace(/```json|```/g, "")
          .replace(/\n/g, "");
        if (Object.keys(data).length > 0) {
          setDocumentInformation(JSON.parse(cleanedContent));
        }
      } catch (error) {
        console.error("Error fetching document data:", error);
      }
    };

    fetchDocumentData();
  }, [textractResults]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      minH="100vh"
      bg="background"
      color="foreground"
      p={4}
    >
      <Box
        w="full"
        maxW="md"
        p={6}
        bg="white"
        borderRadius="lg"
        border="2px solid #E0E0E0"
      >
        <VStack spacing={4}>
          <Heading as="h2" size="lg">
            Upload your file
          </Heading>
          <Box
            {...getRootProps()}
            border="2px dashed"
            borderColor="gray.300"
            borderRadius="md"
            p={4}
            textAlign="center"
            cursor="pointer"
            bg={isDragActive ? "gray.100" : "white"}
          >
            <input
              {...getInputProps()}
              type="file"
              style={{ display: "none" }}
            />
            {isDragActive ? (
              <Text>Drop the files here ...</Text>
            ) : (
              <Text>
                {selectedFile
                  ? selectedFile.name
                  : "Drag and drop some files here, or click to select files"}
              </Text>
            )}
          </Box>
          {errorMessage && <Text color="red.500">{errorMessage}</Text>}
          <Button colorScheme="blue" width="full" onClick={handleUpload}>
            Upload
          </Button>
        </VStack>
      </Box>
      {loadingTextractResults && !documentInformation && (
        <Spinner size="xl" mt={10} />
      )}
      {documentInformation && <DocumentInformation {...documentInformation} />}
      {!loadingTextractResults && (
        <ViewDoc pdfUrl="https://document-reader.s3.us-east-2.amazonaws.com/rayhao_resume.pdf" />
      )}
    </Box>
  );
};

export default FileUploader;
