const createComparisonBtn = document.getElementById("createComparisonBtn");
const comparisonResult = document.getElementById("comparisonResult");
const livesplitFile = document.getElementById("livesplitUploadBtn");
const compTimeInput = document.getElementById("comparisonTimeInput");
const splitsTable = document.getElementById("splitsTable");
const datapoints = ["name", "pbSegmentTime", "compSegmentTime"];
const advancedSettings = document.getElementById("advancedSettings");
const errorMessage = document.getElementById("errorMessage");

let splits;
let attempts;
let compTime = 3419.999;
let segmentArray;

// settings
const segmentsForAverageInput = document.getElementById("segmentsForAverageInput");
const outlierThresholdInput = document.getElementById("outlierThresholdInput");
const timeFormatInput = document.getElementById("outlierThresholdInput");
let segmentsForAverage = 10;
let outlierThreshold = 0.5;
let timeFormat = "RealTime";


// read uploaded file
livesplitFile.addEventListener("change", handleFileSelection); // reads on input idk but it's necessary i think ??
function handleFileSelection(event) {
    const file = livesplitFile.files[0];

    // Read the file
    const reader = new FileReader();
    reader.onload = () => {
        splits = reader.result;
    };
    reader.onerror = () => {
        // error
    };
    reader.readAsText(file);
}


// converts HH:MM:SS.MSMSMS to seconds
function timeToSeconds(time){
    let individualTimes = time.split(":");
    
    // if time has hours
    if(individualTimes.length == 3){
        let hours = Number(individualTimes[0]);
        let minutes = Number(individualTimes[1]);
        let seconds = Number(individualTimes[2]);

        totalTime = (hours*60*60) + (minutes*60) + seconds;
    }
    // if only up to minutes
    else if(individualTimes.length == 2){
        let minutes = Number(individualTimes[0]);
        let seconds = Number(individualTimes[1]);

        totalTime = (minutes*60) + seconds;
    }
    // if invalid time
    else{
        return false
    }
    
    return totalTime
}

function formatTime(seconds){
    try{

        // if no decimals, add a second because idk it's bugged and this is an easy fix lol
        if(seconds % 1 == 0){
            seconds += 1;
        }

        if(seconds >= 3600){ // if has hours
            timeString = new Date(seconds * 1000).toISOString().substring(11, 16);
        }
        else{
            timeString = new Date(seconds * 1000).toISOString().substring(14, 19);
        }
        
        timeString = `${timeString}.${(seconds % 1).toFixed(3).substring(2)}`; // adds decimals to the end

        // remove lead zero if present
        if(timeString[0] == "0"){
            timeString = timeString.substring(1);
        }

        return timeString;
    }
    // returns original if not a time
    catch (error) {
        return seconds;
    }
}


// prepares table for new comparison
function resetTable(){
    splitsTable.replaceChildren(); // remove all existing content

    newRow = document.createElement("tr"); // create headings row

    // make heading elements
    names = document.createElement("th");
    names.textContent = "Split Name";

    pbSegments = document.createElement("th");
    pbSegments.textContent = "PB Segment";

    compSegments = document.createElement("th");
    compSegments.textContent = "Comp Segment";

    // add all to table
    splitsTable.append(newRow);
    newRow.append(names);
    newRow.append(pbSegments);
    newRow.append(compSegments);
}


function toggleAdvancedSettings(){
    if(advancedSettings.style.display === "none"){
        document.getElementById("advancedSettings").style.display = "block";
    }
    else{
        document.getElementById("advancedSettings").style.display = "none";
    }
}


// on button click
function generateComparison(){

    // prepare for new comparison
    resetTable();
    handleFileSelection(null);
    errorMessage.innerText = "" // remove error text

    // get settings
    timeFormat = document.querySelector('input[type=radio][name=TimeFormat]:checked').value;
    segmentsForAverage = segmentsForAverageInput.value;
    outlierThreshold = (outlierThresholdInput.value / 100); // converts from percentage to decimal

    // validate settings
    // if either not a number
    if(isNaN(segmentsForAverage) || isNaN(outlierThreshold)){
        errorMessage.innerText = "Your settings are not valid!"
        comparisonResult.style.display = "none"; // hide table
        return
    }
    if(segmentsForAverage < 1){
        errorMessage.innerText = "Segments Used for Average must be at least 1!"
        comparisonResult.style.display = "none"; // hide table
        return
    }
    

    // get desired comp time in seconds
    compTime = timeToSeconds(compTimeInput.value);

    // initialise splits file
    splits = new DOMParser().parseFromString(splits, "text/xml");
    console.log(splits);
    segments = splits.querySelector("Segments").querySelectorAll("Segment"); // all segments
    allSegments = [];

    // grabs each segment, and finds the average time off gold for it
    for(let segment of segments){
        try{

            // try to get pb segment time, default to "Skipped" if not available
            let pbTime = "Skipped";
            console.log(segment);
            if(segment.querySelector("SplitTimes").querySelector('SplitTime[name="Personal Best"]').querySelector(timeFormat)){
                pbTime = timeToSeconds(segment.querySelector("SplitTimes").querySelector('SplitTime[name="Personal Best"]').querySelector(timeFormat).textContent);
            }

            // creates dictionary for current segment
            currentSegment = {
                "name": segment.querySelector("Name").textContent,
                "gold": timeToSeconds(segment.querySelector("BestSegmentTime").querySelector(timeFormat).textContent),
                "averageTimeOffGold": undefined,
                "pbSegmentTime": pbTime,
                "compSegmentTime": undefined
            }
            
            currentSegmentTimes = segment.querySelector("SegmentHistory").querySelectorAll("Time"); // grabs all time elements for current segment
            
            // makes array of all differences to gold
            let allSegmentDifferences = [];
            for(let time of currentSegmentTimes){
                try{
                    time = timeToSeconds(time.querySelector(timeFormat).textContent); // grabs current segment time
                    let differenceToGold = time - currentSegment.gold; // finds difference

                    // if difference is over [outlierThreshold], discount segment as outlier
                    if(differenceToGold > (currentSegment.gold * outlierThreshold)){
                        continue
                    }

                    allSegmentDifferences.push(differenceToGold);
                }

                catch (error) {
                    console.error(error)
                }
            }

            // remove all but last [segmentsForAverage] segments from array
            allSegmentDifferences = allSegmentDifferences.slice(allSegmentDifferences.length - segmentsForAverage);
            // calculate average and store in dictionary
            let averageTimeOffGold = allSegmentDifferences.reduce((a, b) => a + b) / allSegmentDifferences.length;
            currentSegment.averageTimeOffGold = averageTimeOffGold;

            allSegments.push(currentSegment);

        }
        catch (error) {
            console.error(error)
        }
    }


    // get total expected time off golds, the sob, and correct pb segment time to SEGMENT not exit
    let totalAvgTimeOffGold = 0;
    let sumOfBest = 0;
    let previousExitTime = [0, 0];
    for(let segment of allSegments){
        totalAvgTimeOffGold += segment.averageTimeOffGold;
        sumOfBest += segment.gold;

        previousExitTime[0] = segment.pbSegmentTime; // store current exit time
        segment.pbSegmentTime -= previousExitTime[1]; // subtract using previous exit time
        previousExitTime[1] = previousExitTime[0]; // update exit time to be subtracted next
    }
    
    // sets comp time of each segment by proportion
    let compTimeOffSob = compTime - sumOfBest;
    let proportionOffSob = compTimeOffSob / totalAvgTimeOffGold;
    for(let segment of allSegments){
        segment.compSegmentTime = segment.gold + (segment.averageTimeOffGold * proportionOffSob);
    }
    
    // build table
    for(let segment of allSegments){
        
        let newRow = document.createElement("tr");

        for(let datapoint of datapoints){
            let newTD = document.createElement("td");

            // format text if needed, if NaN then set to skipped as time has not been found
            let newTDText = formatTime(segment[datapoint]);
            if(Number.isNaN(newTDText)){
                newTD.textContent = "Skipped";
            }
            else{
                newTD.textContent = newTDText;
            }
            

            newRow.append(newTD);
        }

        splitsTable.append(newRow);
    }

    comparisonResult.style.display = "block"; // reveal table

}


function copyComparison(){
    // create array of every exit time
    let currentExitTime = 0;
    let exitTimes = [];
    for(let segment of allSegments){
        currentExitTime += segment.compSegmentTime;
        exitTimes.push(formatTime(currentExitTime));
    }

    // build array into formatted string for livesplit
    let formattedComparison = "";
    for(let exit in exitTimes){
        formattedComparison += (`${exitTimes[exit]}\n`);
    }

    // copy text to clipboard
    navigator.clipboard.writeText(formattedComparison);
}